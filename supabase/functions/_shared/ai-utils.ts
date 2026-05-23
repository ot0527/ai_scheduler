import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { AI_LIMITS } from "../../../packages/core/dist/ai/constants.js";

type AIProvider = "openai" | "gemini";

export interface ResolvedAIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

/**
 * ユーザーの AI 設定と Vault / 環境変数から API キーを解決する。
 */
export async function resolveAIConfig(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<ResolvedAIConfig | null> {
  const { data: settings } = await serviceClient
    .from("user_ai_settings")
    .select("provider, model, api_key_ref")
    .eq("user_id", userId)
    .maybeSingle();

  const provider = (settings?.provider ?? "openai") as AIProvider;
  const model =
    settings?.model ??
    (provider === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash");

  if (settings?.api_key_ref) {
    const { data: secret, error } = await serviceClient.rpc("get_api_key_by_ref", {
      p_secret_id: settings.api_key_ref,
    });

    if (!error && typeof secret === "string" && secret.length > 0) {
      return { provider, model, apiKey: secret };
    }
  }

  const envKey =
    provider === "openai"
      ? Deno.env.get("OPENAI_API_KEY")
      : Deno.env.get("GEMINI_API_KEY");

  if (envKey) {
    return { provider, model, apiKey: envKey };
  }

  return null;
}

/**
 * 目標分解の日次レート制限を確認する。
 */
export async function checkGoalDecomposeRateLimit(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { count, error } = await serviceClient
    .from("ai_request_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("request_type", "goal_decompose")
    .gte("created_at", since.toISOString());

  if (error) {
    console.error("rate limit check failed:", error.message);
    return true;
  }
  return (count ?? 0) < AI_LIMITS.goalDecomposePerDay;
}

export function maskSummary(text: string, max = 80): string {
  const trimmed = text.trim().slice(0, max);
  return trimmed.length > 0 ? `${trimmed}…` : "（空）";
}

export async function logAIRequest(
  serviceClient: SupabaseClient,
  params: {
    userId: string;
    requestType: "goal_decompose" | "test_connection";
    inputSummary: string;
    outputSummary?: string;
    provider: AIProvider;
    tokenUsage: Record<string, number>;
  },
) {
  await serviceClient.from("ai_request_logs").insert({
    user_id: params.userId,
    request_type: params.requestType,
    input_summary_masked: params.inputSummary,
    output_summary_masked: params.outputSummary ?? null,
    provider: params.provider,
    token_usage: params.tokenUsage,
  });
}
