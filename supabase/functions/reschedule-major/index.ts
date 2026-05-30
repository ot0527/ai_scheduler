import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  MAJOR_RESCHEDULE_SYSTEM_PROMPT,
  buildMajorRescheduleUserData,
} from "../../../packages/core/dist/ai/prompts/reschedule.js";
import { AI_LIMITS } from "../../../packages/core/dist/ai/constants.js";
import { majorRescheduleOutputSchema } from "../../../packages/core/dist/ai/schemas/reschedule.js";
import { toDateKey } from "../../../packages/core/dist/scheduling/week-utils.js";
import {
  createServiceClient,
  createUserClient,
  requireAuth,
} from "../_shared/auth.ts";
import { callAI } from "../_shared/call-ai.ts";
import {
  checkRescheduleRateLimit,
  assertAIUsageAllowed,
  logAIRequest,
  maskSummary,
  resolveAIConfig,
} from "../_shared/ai-utils.ts";
import { fetchActiveGoalsWithBlocks, runBudgetCalculation } from "../_shared/schedule-utils.ts";
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

  const userClient = createUserClient(auth.authHeader);
  const serviceClient = createServiceClient();
  const todayKey = toDateKey(new Date());

  const allowed = await checkRescheduleRateLimit(serviceClient, auth.userId);
  if (!allowed) {
    return errorResponse("本日の大規模リスケ回数上限（3回）に達しました", 429, req);
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

  try {
    const budgetResult = await runBudgetCalculation(
      userClient,
      auth.userId,
      new Date(),
    );

    const goalsWithBlocks = await fetchActiveGoalsWithBlocks(userClient, auth.userId);
    const behindGoals = budgetResult.budgets
      .filter((budget) => budget.status === "behind" || budget.status === "at_risk")
      .map((budget) => budget.title);

    const userData = buildMajorRescheduleUserData({
      todayKey,
      availableWeeklyMinutes: budgetResult.availableWeeklyMinutes,
      goals: goalsWithBlocks.map(({ goal }) => ({
        id: goal.id,
        title: goal.title,
        deadline: goal.deadline,
        priority: goal.priority,
        estimatedTotalMinutes: goal.estimated_total_minutes,
        completedMinutes: goal.completed_minutes,
        weeklyAvailableMinutes: goal.weekly_available_minutes,
      })),
      budgets: budgetResult.budgets.map((budget) => ({
        goalId: budget.goalId,
        requiredMinutes: budget.requiredMinutes,
        allocatedMinutes: budget.allocatedMinutes,
        completedMinutes: 0,
        status: budget.status,
      })),
      behindGoals,
    });

    const result = await callAI(
      aiConfig.provider,
      aiConfig.model,
      aiConfig.apiKey,
      MAJOR_RESCHEDULE_SYSTEM_PROMPT,
      userData,
      majorRescheduleOutputSchema,
      {
        maxOutputTokens: AI_LIMITS.rescheduleMaxOutputTokens,
        maxRetries: 1,
      },
    );

    await logAIRequest(serviceClient, {
      userId: auth.userId,
      requestType: "reschedule",
      inputSummary: maskSummary(`大規模リスケ ${behindGoals.length}件遅延`),
      outputSummary: maskSummary(result.data.summary),
      provider: aiConfig.provider,
      tokenUsage: result.tokenUsage,
    });

    return jsonResponse(
      {
        preview: result.data,
        tokenUsage: result.tokenUsage,
      },
      200,
      req,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "大規模リスケに失敗しました";
    return errorResponse(message, 502, req);
  }
});
