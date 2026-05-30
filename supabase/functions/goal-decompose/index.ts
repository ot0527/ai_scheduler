import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  GOAL_DECOMPOSE_SYSTEM_PROMPT,
  buildGoalDecomposeUserData,
} from "../../../packages/core/dist/ai/prompts/goal-decompose.js";
import { AI_LIMITS } from "../../../packages/core/dist/ai/constants.js";
import { goalDecomposeOutputSchema } from "../../../packages/core/dist/ai/schemas/goal-decompose.js";
import { normalizeGoalDecomposeOutput } from "../../../packages/core/dist/ai/normalize-goal-decompose.js";
import {
  createServiceClient,
  createUserClient,
  requireAuth,
} from "../_shared/auth.ts";
import { callAI } from "../_shared/call-ai.ts";
import {
  checkGoalDecomposeRateLimit,
  assertAIUsageAllowed,
  logAIRequest,
  maskSummary,
  resolveAIConfig,
} from "../_shared/ai-utils.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

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
  if (!goalId) {
    return errorResponse("goalId が必要です", 400, req);
  }

  const userClient = createUserClient(auth.authHeader);
  const serviceClient = createServiceClient();

  const { data: goal, error: goalError } = await userClient
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", auth.userId)
    .single();

  if (goalError || !goal) {
    return errorResponse("目標が見つかりません", 404, req);
  }

  const { data: prefs } = await userClient
    .from("user_preferences")
    .select("max_session_minutes, focus_times")
    .eq("user_id", auth.userId)
    .single();

  const allowed = await checkGoalDecomposeRateLimit(serviceClient, auth.userId);
  if (!allowed) {
    return errorResponse("本日の目標分解回数上限（5回）に達しました", 429, req);
  }

  const usageError = await assertAIUsageAllowed(serviceClient, auth.userId);
  if (usageError) {
    return errorResponse(usageError, 429, req);
  }

  const aiConfig = await resolveAIConfig(serviceClient, auth.userId);
  if (!aiConfig) {
    return errorResponse(
      "AI API キーが未設定です。設定画面でキーを登録してください",
      400,
      req,
    );
  }

  const userData = buildGoalDecomposeUserData({
    goalTitle: goal.title,
    category: goal.category,
    deadline: goal.deadline,
    currentStatus: goal.current_status ?? undefined,
    targetCondition: goal.target_condition,
    weeklyAvailableMinutes: goal.weekly_available_minutes,
    priority: goal.priority,
    avoidTimeSlots: goal.avoid_time_slots,
    maxSessionMinutes: prefs?.max_session_minutes ?? 60,
    focusTimes: prefs?.focus_times ?? [],
  });

  try {
    const result = await callAI(
      aiConfig.provider,
      aiConfig.model,
      aiConfig.apiKey,
      GOAL_DECOMPOSE_SYSTEM_PROMPT,
      userData,
      goalDecomposeOutputSchema,
      {
        preprocess: (raw) => normalizeGoalDecomposeOutput(raw, goal.title),
        maxOutputTokens: AI_LIMITS.goalDecomposeMaxOutputTokens,
        maxRetries: 1,
      },
    );

    await logAIRequest(serviceClient, {
      userId: auth.userId,
      requestType: "goal_decompose",
      inputSummary: maskSummary(goal.title),
      outputSummary: maskSummary(result.data.goal.summary),
      provider: aiConfig.provider,
      tokenUsage: result.tokenUsage,
    });

    return jsonResponse(
      {
        goalId,
        preview: result.data,
        tokenUsage: result.tokenUsage,
      },
      200,
      req,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI 分解に失敗しました";
    return errorResponse(message, 502, req);
  }
});
