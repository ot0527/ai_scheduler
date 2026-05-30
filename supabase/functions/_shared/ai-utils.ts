import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { AI_LIMITS } from "../../../packages/core/dist/ai/constants.js";

type AIProvider = "openai" | "gemini";

export interface ResolvedAIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export type AIRequestType =
  | "goal_decompose"
  | "reschedule"
  | "chat"
  | "test_connection";

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
      p_user_id: userId,
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
 * 翌月1日の日付キー（yyyy-MM-dd）を返す。
 */
function nextMonthResetDate(from = new Date()): string {
  const year = from.getFullYear();
  const month = from.getMonth();
  const next = new Date(year, month + 1, 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * 月次トークン使用量を必要に応じてリセットする。
 */
export async function resetMonthlyUsageIfNeeded(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data } = await serviceClient
    .from("user_ai_settings")
    .select("usage_reset_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.usage_reset_at) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  if (data.usage_reset_at > todayKey) return;

  await serviceClient
    .from("user_ai_settings")
    .update({
      tokens_used_this_month: 0,
      usage_reset_at: nextMonthResetDate(),
    })
    .eq("user_id", userId);
}

export interface MonthlyTokenStatus {
  allowed: boolean;
  tokensUsed: number;
  monthlyLimit: number | null;
}

/**
 * 月間トークン上限を確認する。上限超過時は allowed=false。
 */
export async function checkMonthlyTokenLimit(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<MonthlyTokenStatus> {
  await resetMonthlyUsageIfNeeded(serviceClient, userId);

  const { data } = await serviceClient
    .from("user_ai_settings")
    .select("monthly_token_limit, tokens_used_this_month")
    .eq("user_id", userId)
    .maybeSingle();

  const tokensUsed = data?.tokens_used_this_month ?? 0;
  const monthlyLimit = data?.monthly_token_limit ?? null;

  if (monthlyLimit == null) {
    return { allowed: true, tokensUsed, monthlyLimit };
  }

  return {
    allowed: tokensUsed < monthlyLimit,
    tokensUsed,
    monthlyLimit,
  };
}

/**
 * AI 呼び出し成功後に月間トークン使用量を加算する。
 */
export async function recordTokenUsage(
  serviceClient: SupabaseClient,
  userId: string,
  totalTokens: number,
): Promise<void> {
  if (totalTokens <= 0) return;

  await resetMonthlyUsageIfNeeded(serviceClient, userId);

  const { data } = await serviceClient
    .from("user_ai_settings")
    .select("tokens_used_this_month")
    .eq("user_id", userId)
    .maybeSingle();

  const current = data?.tokens_used_this_month ?? 0;

  await serviceClient
    .from("user_ai_settings")
    .update({ tokens_used_this_month: current + totalTokens })
    .eq("user_id", userId);
}

async function checkDailyRateLimit(
  serviceClient: SupabaseClient,
  userId: string,
  requestType: AIRequestType,
  limit: number,
): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { count, error } = await serviceClient
    .from("ai_request_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("request_type", requestType)
    .gte("created_at", since.toISOString());

  if (error) {
    console.error("rate limit check failed:", error.message);
    return true;
  }
  return (count ?? 0) < limit;
}

/**
 * 目標分解の日次レート制限を確認する。
 */
export async function checkGoalDecomposeRateLimit(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return checkDailyRateLimit(
    serviceClient,
    userId,
    "goal_decompose",
    AI_LIMITS.goalDecomposePerDay,
  );
}

/**
 * 大規模リスケの日次レート制限を確認する。
 */
export async function checkRescheduleRateLimit(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return checkDailyRateLimit(
    serviceClient,
    userId,
    "reschedule",
    AI_LIMITS.reschedulePerDay,
  );
}

/**
 * AI 相談の日次レート制限を確認する。
 */
export async function checkChatRateLimit(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return checkDailyRateLimit(
    serviceClient,
    userId,
    "chat",
    AI_LIMITS.chatPerDay,
  );
}

export function maskSummary(text: string, max = 80): string {
  const trimmed = text.trim().slice(0, max);
  return trimmed.length > 0 ? `${trimmed}…` : "（空）";
}

export async function logAIRequest(
  serviceClient: SupabaseClient,
  params: {
    userId: string;
    requestType: AIRequestType;
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

  await recordTokenUsage(
    serviceClient,
    params.userId,
    params.tokenUsage.totalTokens ?? 0,
  );
}

/**
 * AI 呼び出し前の共通チェック（月間上限）。
 * 超過時はエラーメッセージを返す。
 */
export async function assertAIUsageAllowed(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const status = await checkMonthlyTokenLimit(serviceClient, userId);
  if (!status.allowed && status.monthlyLimit != null) {
    return `月間トークン上限（${status.monthlyLimit.toLocaleString()}）に達しました。来月までお待ちください。`;
  }
  return null;
}
