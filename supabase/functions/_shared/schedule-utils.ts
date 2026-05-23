import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import type { GoalBudgetCalculationInput } from "../../../packages/core/dist/scheduling/budget.js";
import { calculateWeeklyBudgets } from "../../../packages/core/dist/scheduling/budget.js";
import { mapPlacedBlocksToInsertRows } from "../../../packages/core/dist/mappers/schedule.js";
import { buildScheduleDataSnapshot } from "../../../packages/core/dist/mappers/schedule-input.js";
import { calculateFreeTime } from "../../../packages/core/dist/scheduling/free-time.js";
import { generateDailyPlacement } from "../../../packages/core/dist/scheduling/placement.js";
import type {
  GoalBudgetContext,
  WorkBlockTemplateInput,
} from "../../../packages/core/dist/scheduling/scoring.js";
import { isValidPlacement } from "../../../packages/core/dist/scheduling/validation.js";
import { calculateWeeklyAvailableMinutes } from "../../../packages/core/dist/scheduling/weekly-free-time.js";
import { getWeekPeriod, toDateKey } from "../../../packages/core/dist/scheduling/week-utils.js";

/**
 * Edge Function 用: 指定日のスケジュール入力スナップショットを取得する。
 */
export async function fetchScheduleSnapshot(
  client: SupabaseClient,
  userId: string,
  targetDate: Date,
) {
  const dateKey = toDateKey(targetDate);

  const [prefsRes, routinesRes, fixedRes, overridesRes] = await Promise.all([
    client.from("user_preferences").select("*").eq("user_id", userId).single(),
    client
      .from("life_routines")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order"),
    client.from("fixed_schedules").select("*").eq("user_id", userId),
    client
      .from("routine_day_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("target_date", dateKey),
  ]);

  if (prefsRes.error || !prefsRes.data) {
    throw new Error("基本設定が見つかりません");
  }

  return buildScheduleDataSnapshot({
    preferences: prefsRes.data,
    lifeRoutines: routinesRes.data ?? [],
    fixedSchedules: fixedRes.data ?? [],
    dayOverrides: overridesRes.data ?? [],
    date: targetDate,
  });
}

/**
 * Edge Function 用: 週次空き時間計算用のベースデータを取得する。
 */
async function fetchWeeklyFreeTimeInput(client: SupabaseClient, userId: string) {
  const [prefsRes, routinesRes, fixedRes] = await Promise.all([
    client.from("user_preferences").select("*").eq("user_id", userId).single(),
    client
      .from("life_routines")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order"),
    client.from("fixed_schedules").select("*").eq("user_id", userId),
  ]);

  if (prefsRes.error || !prefsRes.data) {
    throw new Error("基本設定が見つかりません");
  }

  const snapshot = buildScheduleDataSnapshot({
    preferences: prefsRes.data,
    lifeRoutines: routinesRes.data ?? [],
    fixedSchedules: fixedRes.data ?? [],
    dayOverrides: [],
    date: new Date(),
  });

  return {
    preferencesRow: prefsRes.data,
    lifeRoutines: snapshot.lifeRoutines,
    fixedSchedules: snapshot.fixedSchedules,
  };
}

/**
 * Edge Function 用: アクティブ目標と作業ブロックを取得する。
 */
export async function fetchActiveGoalsWithBlocks(
  client: SupabaseClient,
  userId: string,
) {
  const { data: goals, error } = await client
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  if (!goals?.length) return [];

  const goalIds = goals.map((goal) => goal.id);
  const { data: blocks, error: blocksError } = await client
    .from("work_block_templates")
    .select("*")
    .in("goal_id", goalIds)
    .order("sort_order");

  if (blocksError) throw new Error(blocksError.message);

  return goals.map((goal) => ({
    goal,
    blocks: (blocks ?? []).filter((block) => block.goal_id === goal.id),
  }));
}

/**
 * 週次時間予算を計算し DB に保存する。
 */
export async function runBudgetCalculation(
  client: SupabaseClient,
  userId: string,
  referenceDate: Date,
) {
  const period = getWeekPeriod(referenceDate);
  const todayKey = toDateKey(referenceDate);
  const goalsWithBlocks = await fetchActiveGoalsWithBlocks(client, userId);

  if (goalsWithBlocks.length === 0) {
    return {
      period,
      budgets: [],
      availableWeeklyMinutes: 0,
      suggestions: [
        "アクティブな目標がありません。目標を登録して AI 分解を承認してください。",
      ],
    };
  }

  const weeklyInput = await fetchWeeklyFreeTimeInput(client, userId);
  const availableWeeklyMinutes = calculateWeeklyAvailableMinutes(
    weeklyInput,
    referenceDate,
  );

  const inputs: GoalBudgetCalculationInput[] = goalsWithBlocks
    .filter(({ goal }) => goal.estimated_total_minutes != null)
    .map(({ goal }) => ({
      goalId: goal.id,
      title: goal.title,
      deadline: goal.deadline,
      priority: goal.priority,
      estimatedTotalMinutes: goal.estimated_total_minutes!,
      completedMinutes: goal.completed_minutes,
      weeklyAvailableMinutes: goal.weekly_available_minutes,
      todayKey,
    }));

  const result = calculateWeeklyBudgets(inputs, availableWeeklyMinutes, period);

  for (const budget of result.budgets) {
    const { error } = await client.from("goal_budgets").upsert(
      {
        user_id: userId,
        goal_id: budget.goalId,
        period_start: result.periodStart,
        period_end: result.periodEnd,
        required_minutes: budget.requiredMinutes,
        allocated_minutes: budget.allocatedMinutes,
        status: budget.status,
        warning_message: budget.warningMessage,
      },
      { onConflict: "goal_id,period_start" },
    );
    if (error) throw new Error(error.message);
  }

  if (result.shortageMinutes > 0) {
    await client.from("alerts").delete().eq("user_id", userId).eq("is_read", false);

    await client.from("alerts").insert({
      user_id: userId,
      goal_id: null,
      severity: "warning",
      message: `今週の自由時間が不足しています（${Math.ceil(result.shortageMinutes / 60)}時間不足）`,
      suggestions: result.suggestions,
    });
  }

  return { period, ...result };
}

/**
 * 日次スケジュールを生成し draft として保存する。
 */
export async function runScheduleGeneration(
  client: SupabaseClient,
  userId: string,
  targetDate: Date,
) {
  const dateKey = toDateKey(targetDate);
  const period = getWeekPeriod(targetDate);
  const goalsWithBlocks = await fetchActiveGoalsWithBlocks(client, userId);

  if (goalsWithBlocks.length === 0) {
    throw new Error("アクティブな目標がありません");
  }

  const { data: budgets, error: budgetError } = await client
    .from("goal_budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", period.periodStart);

  if (budgetError) throw new Error(budgetError.message);

  const snapshot = await fetchScheduleSnapshot(client, userId, targetDate);
  const freeTime = calculateFreeTime({ ...snapshot, date: targetDate });

  const templates: WorkBlockTemplateInput[] = goalsWithBlocks.flatMap(({ blocks }) =>
    blocks.map((block) => ({
      id: block.id,
      goalId: block.goal_id,
      componentId: block.component_id,
      title: block.title,
      minMinutes: block.min_minutes,
      idealMinutes: block.ideal_minutes,
      maxMinutes: block.max_minutes,
      energy: block.energy,
      preferredTime: block.preferred_time,
      requiresDeepWork: block.requires_deep_work,
      orderType: block.order_type,
    })),
  );

  const budgetContexts: GoalBudgetContext[] = goalsWithBlocks.map(({ goal }) => {
    const budget = budgets?.find((item) => item.goal_id === goal.id);
    return {
      goalId: goal.id,
      goalTitle: goal.title,
      allocatedMinutes: budget?.allocated_minutes ?? goal.weekly_available_minutes,
      completedMinutesThisWeek: budget?.completed_minutes ?? 0,
      deadline: goal.deadline,
      priority: goal.priority,
    };
  });

  const prefsRes = await client
    .from("user_preferences")
    .select("focus_times")
    .eq("user_id", userId)
    .single();

  const placement = generateDailyPlacement(
    freeTime,
    templates,
    budgetContexts,
    prefsRes.data?.focus_times ?? [],
    dateKey,
  );

  if (!isValidPlacement(freeTime, placement.blocks)) {
    throw new Error("生成されたスケジュールに衝突があります");
  }

  const summary =
    placement.blocks.length > 0
      ? `${placement.blocks.length} 件の作業を配置しました`
      : "配置できる作業ブロックがありませんでした";

  const { data: existingSchedule } = await client
    .from("schedules")
    .select("id, status")
    .eq("user_id", userId)
    .eq("target_date", dateKey)
    .maybeSingle();

  if (existingSchedule?.status === "approved") {
    throw new Error(
      "承認済みの予定があります。再提案する場合は先にキャンセルしてください",
    );
  }

  let scheduleId = existingSchedule?.id;

  if (scheduleId) {
    await client.from("scheduled_blocks").delete().eq("schedule_id", scheduleId);
    await client
      .from("schedules")
      .update({ status: "draft", summary, approved_at: null })
      .eq("id", scheduleId);
  } else {
    const { data: inserted, error: insertError } = await client
      .from("schedules")
      .insert({
        user_id: userId,
        target_date: dateKey,
        status: "draft",
        summary,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "スケジュール保存に失敗しました");
    }
    scheduleId = inserted.id;
  }

  const blockRows = mapPlacedBlocksToInsertRows(scheduleId!, placement.blocks);
  if (blockRows.length > 0) {
    const { error: blocksError } = await client.from("scheduled_blocks").insert(blockRows);
    if (blocksError) throw new Error(blocksError.message);
  }

  const { data: schedule } = await client
    .from("schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();

  const { data: savedBlocks } = await client
    .from("scheduled_blocks")
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("sort_order");

  return {
    schedule,
    blocks: savedBlocks ?? [],
    placement,
    freeTime: {
      wakeTime: freeTime.wakeTime,
      sleepTime: freeTime.sleepTime,
      totalFreeMinutes: freeTime.freeSlots.reduce(
        (sum, slot) => sum + slot.durationMinutes,
        0,
      ),
    },
  };
}
