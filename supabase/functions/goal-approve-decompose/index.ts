import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { goalDecomposeApproveSchema } from "../../../packages/core/dist/ai/schemas/goal-decompose.js";
import { createUserClient, requireAuth } from "../_shared/auth.ts";
import {
  errorResponse,
  getCorsHeaders,
  internalErrorResponse,
  jsonResponse,
} from "../_shared/cors.ts";

/**
 * AI 目標分解の承認を確定する。
 * 構成要素の入れ替え・作業ブロック生成・目標更新は
 * approve_goal_decompose RPC 内で単一トランザクションとして実行される。
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const goalId = body?.goalId as string | undefined;
  const decompose = body?.decompose;

  if (!goalId || !decompose) {
    return errorResponse("goalId と decompose が必要です", 400, req);
  }

  const parsed = goalDecomposeApproveSchema.safeParse(decompose);
  if (!parsed.success) {
    return errorResponse("分解結果の形式が不正です", 400, req);
  }

  const userClient = createUserClient(auth.authHeader);

  const { data: goal, error: goalError } = await userClient
    .from("goals")
    .select("id, status")
    .eq("id", goalId)
    .eq("user_id", auth.userId)
    .single();

  if (goalError || !goal) {
    return errorResponse("目標が見つかりません", 404, req);
  }

  const { error: approveError } = await userClient.rpc("approve_goal_decompose", {
    p_goal_id: goalId,
    p_payload: parsed.data,
  });

  if (approveError) {
    if (approveError.message.includes("unknown component reference")) {
      return errorResponse("不明な構成要素が含まれています", 400, req);
    }
    return internalErrorResponse("goal-approve-decompose rpc", approveError, req);
  }

  return jsonResponse({ goalId, status: "active" }, 200, req);
});
