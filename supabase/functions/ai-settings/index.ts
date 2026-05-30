import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  GEMINI_MODELS,
  OPENAI_MODELS,
} from "../../../packages/core/dist/ai/constants.js";
import {
  createServiceClient,
  createUserClient,
  requireAuth,
} from "../_shared/auth.ts";
import { testAIConnection } from "../_shared/call-ai.ts";
import { logAIRequest, maskSummary } from "../_shared/ai-utils.ts";
import {
  errorResponse,
  getCorsHeaders,
  internalErrorResponse,
  jsonResponse,
} from "../_shared/cors.ts";

type AIProvider = "openai" | "gemini";
type AITone = "polite" | "casual" | "concise";

function resolveProvider(value: unknown): AIProvider | null {
  return value === "openai" || value === "gemini" ? value : null;
}

function resolveModel(provider: AIProvider, model: unknown): string {
  const allowed = provider === "openai" ? OPENAI_MODELS : GEMINI_MODELS;
  const defaultModel =
    provider === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash";
  if (typeof model === "string" && (allowed as readonly string[]).includes(model)) {
    return model;
  }
  return defaultModel;
}

function resolveAiTone(value: unknown): AITone {
  if (value === "polite" || value === "casual" || value === "concise") {
    return value;
  }
  return "polite";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const userClient = createUserClient(auth.authHeader);
  const serviceClient = createServiceClient();

  if (req.method === "GET") {
    const { data } = await userClient
      .from("user_ai_settings")
      .select(
        "provider, model, api_key_last4, monthly_token_limit, tokens_used_this_month, ai_tone",
      )
      .eq("user_id", auth.userId)
      .maybeSingle();

    return jsonResponse(
      {
        configured: !!data?.api_key_last4,
        provider: data?.provider ?? "openai",
        model: data?.model ?? "gpt-4o-mini",
        apiKeyLast4: data?.api_key_last4 ?? null,
        monthlyTokenLimit: data?.monthly_token_limit ?? null,
        tokensUsedThisMonth: data?.tokens_used_this_month ?? 0,
        aiTone: data?.ai_tone ?? "polite",
      },
      200,
      req,
    );
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req);
  }

  const body = await req.json().catch(() => null);
  const provider = resolveProvider(body?.provider ?? "openai");
  if (!provider) {
    return errorResponse("provider は openai または gemini を指定してください", 400, req);
  }

  const resolvedModel = resolveModel(provider, body?.model);
  const apiKey = body?.apiKey as string | undefined;
  const monthlyTokenLimit = body?.monthlyTokenLimit as number | null | undefined;
  const aiTone = resolveAiTone(body?.aiTone);

  const { data: existing } = await serviceClient
    .from("user_ai_settings")
    .select("id, api_key_ref, api_key_last4")
    .eq("user_id", auth.userId)
    .maybeSingle();

  // API キーなし: 口調・上限・モデルのみ更新（service_role 経由）
  if (!apiKey) {
    if (!existing) {
      return errorResponse("初回登録時は API キーが必要です", 400, req);
    }

    const { error } = await serviceClient
      .from("user_ai_settings")
      .update({
        provider,
        model: resolvedModel,
        monthly_token_limit: monthlyTokenLimit ?? null,
        ai_tone: aiTone,
      })
      .eq("user_id", auth.userId);

    if (error) {
      return internalErrorResponse("ai-settings update", error, req);
    }

    return jsonResponse(
      {
        configured: !!existing.api_key_last4,
        provider,
        model: resolvedModel,
        apiKeyLast4: existing.api_key_last4,
        aiTone,
      },
      200,
      req,
    );
  }

  if (apiKey.length < 8) {
    return errorResponse("有効な API キーを入力してください", 400, req);
  }

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
      return internalErrorResponse("ai-settings vault store", vaultError, req);
    }

    const settingsRow = {
      provider,
      model: resolvedModel,
      api_key_ref: secretId as string,
      api_key_last4: last4,
      monthly_token_limit: monthlyTokenLimit ?? null,
      ai_tone: aiTone,
    };

    if (existing) {
      const { error } = await serviceClient
        .from("user_ai_settings")
        .update(settingsRow)
        .eq("user_id", auth.userId);
      if (error) {
        return internalErrorResponse("ai-settings update with key", error, req);
      }
    } else {
      const { error } = await serviceClient.from("user_ai_settings").insert({
        user_id: auth.userId,
        ...settingsRow,
      });
      if (error) {
        return internalErrorResponse("ai-settings insert", error, req);
      }
    }

    await logAIRequest(serviceClient, {
      userId: auth.userId,
      requestType: "test_connection",
      inputSummary: maskSummary(`${provider} connection test`),
      outputSummary: "ok",
      provider,
      tokenUsage,
    });

    return jsonResponse(
      {
        configured: true,
        provider,
        model: resolvedModel,
        apiKeyLast4: last4,
        aiTone,
      },
      200,
      req,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "接続テストに失敗しました";
    return errorResponse(message, 400, req);
  }
});
