import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceClient,
  createUserClient,
  requireAuth,
} from "../_shared/auth.ts";
import { testAIConnection } from "../_shared/call-ai.ts";
import { logAIRequest, maskSummary, resolveAIConfig } from "../_shared/ai-utils.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const userClient = createUserClient(auth.authHeader);
  const serviceClient = createServiceClient();

  if (req.method === "GET") {
    const { data } = await userClient
      .from("user_ai_settings")
      .select(
        "provider, model, api_key_last4, monthly_token_limit, tokens_used_this_month",
      )
      .eq("user_id", auth.userId)
      .maybeSingle();

    return jsonResponse({
      configured: !!data?.api_key_last4,
      provider: data?.provider ?? "openai",
      model: data?.model ?? "gpt-4o-mini",
      apiKeyLast4: data?.api_key_last4 ?? null,
      monthlyTokenLimit: data?.monthly_token_limit ?? null,
      tokensUsedThisMonth: data?.tokens_used_this_month ?? 0,
    });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await req.json().catch(() => null);
  const provider = (body?.provider ?? "openai") as "openai" | "gemini";
  const model = body?.model as string | undefined;
  const apiKey = body?.apiKey as string | undefined;
  const monthlyTokenLimit = body?.monthlyTokenLimit as number | null | undefined;

  if (!apiKey || apiKey.length < 8) {
    return errorResponse("有効な API キーを入力してください");
  }

  const resolvedModel =
    model ?? (provider === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash");

  try {
    const tokenUsage = await testAIConnection(provider, resolvedModel, apiKey);
    const last4 = apiKey.slice(-4);
    const secretName = `user_${auth.userId}_${provider}`;

    const { data: secretId, error: vaultError } = await userClient.rpc(
      "store_user_api_key",
      {
        p_user_id: auth.userId,
        p_secret: apiKey,
        p_secret_name: secretName,
      },
    );

    if (vaultError || !secretId) {
      return errorResponse(vaultError?.message ?? "キーの保存に失敗しました", 500);
    }

    const { data: existing } = await userClient
      .from("user_ai_settings")
      .select("id")
      .eq("user_id", auth.userId)
      .maybeSingle();

    const settingsRow = {
      provider,
      model: resolvedModel,
      api_key_ref: secretId as string,
      api_key_last4: last4,
      monthly_token_limit: monthlyTokenLimit ?? null,
    };

    if (existing) {
      const { error } = await userClient
        .from("user_ai_settings")
        .update(settingsRow)
        .eq("user_id", auth.userId);
      if (error) return errorResponse(error.message, 500);
    } else {
      const { error } = await userClient.from("user_ai_settings").insert({
        user_id: auth.userId,
        ...settingsRow,
      });
      if (error) return errorResponse(error.message, 500);
    }

    await logAIRequest(serviceClient, {
      userId: auth.userId,
      requestType: "test_connection",
      inputSummary: maskSummary(`${provider} connection test`),
      outputSummary: "ok",
      provider,
      tokenUsage,
    });

    return jsonResponse({
      configured: true,
      provider,
      model: resolvedModel,
      apiKeyLast4: last4,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "接続テストに失敗しました";
    return errorResponse(message, 400);
  }
});
