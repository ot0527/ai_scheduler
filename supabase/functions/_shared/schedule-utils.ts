import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import type { GoalBudgetCalculationInput } from "../../../packages/core/dist/scheduling/budget.js";
import { calculateWeeklyBudgets } from "../../../packages/core/dist/scheduling/budget.js";
import { mapPlacedBlocksToInsertRows } from "../../../packages/core/dist/mappers/schedule.js";
import { buildScheduleDataSnapshot } from "../../../packages/core/dist/mappers/schedule-input.js";
import { calculateFreeTime } from "../../../packages/core/dist/scheduling/free-time.js";
import { generateDailyPlacement } from "../../../packages/core/dist/scheduling/placement.js";
import {
  needsReschedule,
  remainingMinutesFromBlock,
} from "../../../packages/core/dist/scheduling/execution.js";
import {
  planMinorReschedule,
  type RescheduleCandidate,
} from "../../../packages/core/dist/scheduling/reschedule-minor.js";
import type {
  GoalBudgetContext,
  ScoringExecutionContext,
  WorkBlockTemplateInput,
} from "../../../packages/core/dist/scheduling/scoring.js";
import { isValidPlacement } from "../../../packages/core/dist/scheduling/validation.js";
import { calculateWeeklyAvailableMinutes } from "../../../packages/core/dist/scheduling/weekly-free-time.js";
import { addDays, getWeekPeriod, parseDateKey, toDateKey } from "../../../packages/core/dist/scheduling/week-utils.js";

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
 * 直近の完了ブロックからスコアリング用コンテキストを取得する。
 */
async function fetchExecutionContext(
  client: SupabaseClient,
  userId: string,
  targetDateKey: string,
): Promise<ScoringExecutionContext> {
  const since = toDateKey(addDays(parseDateKey(targetDateKey), -14));

  const { data: recentSchedules } = await client
    .from("schedules")
    .select("id")
    .eq("user_id", userId)
    .gte("target_date", since)
    .lte("target_date", targetDateKey);

  const scheduleIds = (recentSchedules ?? []).map((schedule) => schedule.id);

  let recentCompletedTemplateIds: string[] = [];

  if (scheduleIds.length > 0) {
    const { data: recentBlocks } = await client
      .from("scheduled_blocks")
      .select("work_block_template_id")
      .in("schedule_id", scheduleIds)
      .in("status", ["done", "partial"])
      .not("work_block_template_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    recentCompletedTemplateIds = [
      ...new Set(
        (recentBlocks ?? [])
          .map((block) => block.work_block_template_id)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];
  }

  const { data: yesterdaySchedule } = await client
    .from("schedules")
    .select("fatigue_level")
    .eq("user_id", userId)
    .eq("target_date", toDateKey(addDays(parseDateKey(targetDateKey), -1)))
    .maybeSingle();

  return {
    fatigueLevel: yesterdaySchedule?.fatigue_level ?? 3,
    recentCompletedTemplateIds,
  };
}

/**
 * 承認済みスケジュールをキャンセルする。
 */
export async function cancelApprovedSchedule(
  client: SupabaseClient,
  userId: string,
  scheduleId: string,
) {
  const { data, error } = await client
    .from("schedules")
    .update({ status: "cancelled", approved_at: null })
    .eq("id", scheduleId)
    .eq("user_id", userId)
    .in("status", ["approved", "in_progress"])
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("キャンセルできる承認済み予定が見つかりません");
  }

  return data;
}

/**
 * 未完了ブロックを翌日以降へ小規模リスケする。
 */
export async function runMinorReschedule(
  client: SupabaseClient,
  userId: string,
  sourceDate: Date,
) {
  const sourceDateKey = toDateKey(sourceDate);
  const tomorrowKey = toDateKey(addDays(sourceDate, 1));

  const { data: sourceSchedule, error: scheduleError } = await client
    .from("schedules")
    .select("id, status")
    .eq("user_id", userId)
    .eq("target_date", sourceDateKey)
    .maybeSingle();

  if (scheduleError) throw new Error(scheduleError.message);
  if (!sourceSchedule) {
    throw new Error("対象日のスケジュールが見つかりません");
  }

  const { data: blocks, error: blocksError } = await client
    .from("scheduled_blocks")
    .select("*")
    .eq("schedule_id", sourceSchedule.id)
    .order("sort_order");

  if (blocksError) throw new Error(blocksError.message);

  const candidates: RescheduleCandidate[] = (blocks ?? [])
    .filter((block) =>
      needsReschedule(block.status, block.planned_minutes, block.actual_minutes)
    )
    .map((block) => ({
      sourceBlockId: block.id,
      workBlockTemplateId: block.work_block_template_id,
      goalId: block.goal_id,
      componentId: block.component_id,
      title: block.title,
      remainingMinutes: remainingMinutesFromBlock(
        block.planned_minutes,
        block.actual_minutes,
      ),
    }));

  if (candidates.length === 0) {
    throw new Error("再配置が必要な未完了ブロックがありません");
  }

  const goalsWithBlocks = await fetchActiveGoalsWithBlocks(client, userId);
  const templateById = new Map<string, WorkBlockTemplateInput>();

  for (const { blocks: templates } of goalsWithBlocks) {
    for (const template of templates) {
      templateById.set(template.id, {
        id: template.id,
        goalId: template.goal_id,
        componentId: template.component_id,
        title: template.title,
        minMinutes: template.min_minutes,
        idealMinutes: template.ideal_minutes,
        maxMinutes: template.max_minutes,
        energy: template.energy,
        preferredTime: template.preferred_time,
        requiresDeepWork: template.requires_deep_work,
        orderType: template.order_type,
      });
    }
  }

  const plan = await planMinorReschedule(
    candidates,
    async (dateKey) => {
      const snapshot = await fetchScheduleSnapshot(
        client,
        userId,
        parseDateKey(dateKey),
      );
      return calculateFreeTime({ ...snapshot, date: parseDateKey(dateKey) });
    },
    (candidate) =>
      candidate.workBlockTemplateId
        ? templateById.get(candidate.workBlockTemplateId) ?? null
        : null,
    { startDateKey: tomorrowKey, maxDays: 7 },
  );

  if (plan.placements.length === 0) {
    throw new Error("再配置先の空き時間が見つかりませんでした");
  }

  for (const placement of plan.placements) {
    await client
      .from("scheduled_blocks")
      .update({ status: "rescheduled" })
      .eq("id", placement.candidate.sourceBlockId);
  }

  const results: Array<{ targetDate: string; scheduleId: string; blockCount: number }> =
    [];

  const placementsByDate = new Map<string, typeof plan.placements>();
  for (const placement of plan.placements) {
    const list = placementsByDate.get(placement.targetDateKey) ?? [];
    list.push(placement);
    placementsByDate.set(placement.targetDateKey, list);
  }

  for (const [targetDateKey, datePlacements] of placementsByDate) {
    const { data: existing } = await client
      .from("schedules")
      .select("id, status")
      .eq("user_id", userId)
      .eq("target_date", targetDateKey)
      .maybeSingle();

    if (existing?.status === "approved") {
      continue;
    }

    const summary = `${datePlacements.length} 件の再配置案`;

    let scheduleId = existing?.id;

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
          target_date: targetDateKey,
          status: "draft",
          summary,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        throw new Error(insertError?.message ?? "再配置スケジュールの保存に失敗しました");
      }
      scheduleId = inserted.id;
    }

    const blockRows = mapPlacedBlocksToInsertRows(
      scheduleId!,
      datePlacements.map((item) => item.block),
    );

    if (blockRows.length > 0) {
      const { error: insertBlocksError } = await client
        .from("scheduled_blocks")
        .insert(blockRows);
      if (insertBlocksError) throw new Error(insertBlocksError.message);
    }

    results.push({
      targetDate: targetDateKey,
      scheduleId: scheduleId!,
      blockCount: blockRows.length,
    });
  }

  return {
    sourceDate: sourceDateKey,
    placedCount: plan.placements.length,
    unplacedCount: plan.unplaced.length,
    proposals: results,
    unplaced: plan.unplaced.map((item) => item.title),
  };
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

  const executionContext = await fetchExecutionContext(client, userId, dateKey);

  const placement = generateDailyPlacement(
    freeTime,
    templates,
    budgetContexts,
    prefsRes.data?.focus_times ?? [],
    dateKey,
    executionContext,
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
