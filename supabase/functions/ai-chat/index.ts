import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  buildChatSystemPrompt,
  buildChatUserData,
} from "../../../packages/core/dist/ai/prompts/chat.js";
import { AI_LIMITS } from "../../../packages/core/dist/ai/constants.js";
import { chatOutputSchema, chatRequestSchema } from "../../../packages/core/dist/ai/schemas/chat.js";
import { normalizeChatOutput } from "../../../packages/core/dist/ai/normalize-chat.js";
import { getWeekPeriod, toDateKey } from "../../../packages/core/dist/scheduling/week-utils.js";
import {
  createServiceClient,
  createUserClient,
  requireAuth,
} from "../_shared/auth.ts";
import { callAI } from "../_shared/call-ai.ts";
import {
  assertAIUsageAllowed,
  checkChatRateLimit,
  logAIRequest,
  maskSummary,
  resolveAIConfig,
} from "../_shared/ai-utils.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("入力が不正です");
  }

  const userClient = createUserClient(auth.authHeader);
  const serviceClient = createServiceClient();
  const todayKey = toDateKey(new Date());

  const usageError = await assertAIUsageAllowed(serviceClient, auth.userId);
  if (usageError) {
    return errorResponse(usageError, 429);
  }

  const allowed = await checkChatRateLimit(serviceClient, auth.userId);
  if (!allowed) {
    return errorResponse(
      `本日の AI 相談回数上限（${AI_LIMITS.chatPerDay}回）に達しました`,
      429,
    );
  }

  const aiConfig = await resolveAIConfig(serviceClient, auth.userId);
  if (!aiConfig) {
    return errorResponse(
      "AI API キーが未設定です。設定画面でキーを登録してください",
      400,
    );
  }

  const { data: aiSettings } = await userClient
    .from("user_ai_settings")
    .select("ai_tone")
    .eq("user_id", auth.userId)
    .maybeSingle();

  const aiTone = (aiSettings?.ai_tone ?? "polite") as
    | "polite"
    | "casual"
    | "concise";

  const { data: goals } = await userClient
    .from("goals")
    .select("title, status, deadline, completed_minutes, estimated_total_minutes")
    .eq("user_id", auth.userId)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: true });

  const period = getWeekPeriod(new Date());
  const { data: budgets } = await userClient
    .from("goal_budgets")
    .select("goal_id, required_minutes, allocated_minutes, status")
    .eq("user_id", auth.userId)
    .eq("period_start", period.periodStart);

  const goalIds = (budgets ?? []).map((b) => b.goal_id);
  let budgetWithTitles: Array<{
    goalTitle: string;
    status: string;
    requiredMinutes: number;
    allocatedMinutes: number;
  }> = [];

  if (goalIds.length > 0) {
    const { data: budgetGoals } = await userClient
      .from("goals")
      .select("id, title")
      .in("id", goalIds);

    const titleMap = new Map((budgetGoals ?? []).map((g) => [g.id, g.title]));
    budgetWithTitles = (budgets ?? []).map((b) => ({
      goalTitle: titleMap.get(b.goal_id) ?? "目標",
      status: b.status,
      requiredMinutes: b.required_minutes,
      allocatedMinutes: b.allocated_minutes,
    }));
  }

  const { data: schedule } = await userClient
    .from("schedules")
    .select("id, status")
    .eq("user_id", auth.userId)
    .eq("target_date", todayKey)
    .maybeSingle();

  let pendingBlockCount = 0;
  if (schedule) {
    const { count } = await userClient
      .from("scheduled_blocks")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", schedule.id)
      .eq("status", "pending");

    pendingBlockCount = count ?? 0;
  }

  const { data: alerts } = await userClient
    .from("alerts")
    .select("message")
    .eq("user_id", auth.userId)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(3);

  const userData = buildChatUserData({
    message: parsed.data.message,
    history: parsed.data.history,
    todayKey,
    aiTone,
    goals: (goals ?? []).map((g) => ({
      title: g.title,
      status: g.status,
      deadline: g.deadline,
      completedMinutes: g.completed_minutes,
      estimatedTotalMinutes: g.estimated_total_minutes,
    })),
    budgets: budgetWithTitles,
    todayScheduleStatus: schedule?.status ?? null,
    pendingBlockCount,
    alerts: (alerts ?? []).map((a) => a.message),
  });

  try {
    const result = await callAI(
      aiConfig.provider,
      aiConfig.model,
      aiConfig.apiKey,
      buildChatSystemPrompt(aiTone),
      userData,
      chatOutputSchema,
      {
        preprocess: normalizeChatOutput,
        maxOutputTokens: AI_LIMITS.chatMaxOutputTokens,
        maxRetries: 1,
      },
    );

    await logAIRequest(serviceClient, {
      userId: auth.userId,
      requestType: "chat",
      inputSummary: maskSummary(parsed.data.message),
      outputSummary: maskSummary(result.data.reply),
      provider: aiConfig.provider,
      tokenUsage: result.tokenUsage,
    });

    return jsonResponse({
      reply: result.data.reply,
      suggestedActions: result.data.suggestedActions ?? [],
      tokenUsage: result.tokenUsage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI 相談に失敗しました";
    return errorResponse(message, 502);
  }
});
