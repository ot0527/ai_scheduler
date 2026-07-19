import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  BlockCompletionStatus,
  FatigueLevel,
  MajorRescheduleOutput,
  ScheduleRow,
} from "@ai-scheduler/core";
import {
  getWeekPeriod,
  isScheduleFullyRecorded,
  resolveActualMinutes,
} from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { toLocalDateKey } from "@/hooks/useBudgets";
import { invokeFunction } from "@/lib/edge-functions";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";

/** ブロック完了記録の入力 */
export interface RecordBlockInput {
  blockId: string;
  scheduleId: string;
  goalId: string;
  plannedMinutes: number;
  status: BlockCompletionStatus;
  actualMinutes?: number;
  targetDate: string;
}

/** 日次振り返りの入力 */
export interface DailyReviewInput {
  scheduleId: string;
  targetDate: string;
  fatigueLevel: FatigueLevel;
  reviewNote?: string;
}

/** 小規模リスケの結果 */
export interface MinorRescheduleResult {
  sourceDate: string;
  placedCount: number;
  unplacedCount: number;
  proposals: Array<{ targetDate: string; scheduleId: string; blockCount: number }>;
  unplaced: string[];
}

/** 大規模リスケのプレビュー結果 */
export interface MajorReschedulePreview {
  preview: MajorRescheduleOutput;
}

/**
 * 作業ブロックの完了記録を保存し、進捗を更新する。
 */
export function useRecordBlockCompletion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: RecordBlockInput) => {
      const actualMinutes = resolveActualMinutes(
        input.status,
        input.plannedMinutes,
        input.actualMinutes,
      );
      const dbStatus =
        input.status === "done"
          ? "done"
          : input.status === "partial"
            ? "partial"
            : "skipped";

      // ブロック・目標・週次予算を単一トランザクションの RPC で更新する。
      // 差分は DB 上の旧 actual_minutes から計算されるため、
      // 並行記録や後段失敗後の再試行でも二重加算しない。
      const period = getWeekPeriod(new Date(input.targetDate + "T12:00:00"));
      const { error: recordError } = await supabase.rpc(
        "record_block_completion",
        {
          p_block_id: input.blockId,
          p_status: dbStatus,
          p_actual_minutes: actualMinutes,
          p_period_start: period.periodStart,
        },
      );

      if (recordError) throw recordError;

      const { data: allBlocks, error: blocksError } = await supabase
        .from("scheduled_blocks")
        .select("status")
        .eq("schedule_id", input.scheduleId);

      if (blocksError) throw blocksError;

      if (isScheduleFullyRecorded((allBlocks ?? []).map((block) => block.status))) {
        await supabase
          .from("schedules")
          .update({ status: "completed" })
          .eq("id", input.scheduleId)
          .eq("user_id", user!.id);
      } else {
        await supabase
          .from("schedules")
          .update({ status: "in_progress" })
          .eq("id", input.scheduleId)
          .eq("user_id", user!.id)
          .in("status", ["approved", "in_progress"]);
      }

      return { actualMinutes };
    },
    onSuccess: async (_, input) => {
      if (!user) return;
      const period = getWeekPeriod(new Date(input.targetDate + "T12:00:00"));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.schedule(user.id, input.targetDate),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.goals(user.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.goalBudgets(user.id, period.periodStart),
        }),
      ]);
    },
  });
}

/** 日次振り返り（疲労度・メモ）を保存する。 */
export function useSubmitDailyReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: DailyReviewInput) => {
      const { data, error } = await supabase
        .from("schedules")
        .update({
          fatigue_level: input.fatigueLevel,
          review_note: input.reviewNote?.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.scheduleId)
        .eq("user_id", user!.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (schedule) => {
      if (!user || !schedule) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(user.id, schedule.target_date),
      });
    },
  });
}

/** 承認済みスケジュールをキャンセルする。 */
export function useCancelSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { scheduleId: string; targetDate: string }) => {
      const { data, error } = await supabase
        .from("schedules")
        .update({ status: "cancelled", approved_at: null })
        .eq("id", params.scheduleId)
        .eq("user_id", user!.id)
        .in("status", ["approved", "in_progress"])
        .select("*")
        .single();

      if (error) throw error;
      return data as ScheduleRow;
    },
    onSuccess: async (schedule) => {
      if (!user || !schedule) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(user.id, schedule.target_date),
      });
    },
  });
}

/** 未完了ブロックの小規模リスケ（非 AI）を実行する。 */
export function useMinorReschedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sourceDate?: string) => {
      return invokeFunction<MinorRescheduleResult>("schedule-reschedule-minor", {
        body: { sourceDate },
      });
    },
    onSuccess: async (result) => {
      if (!user) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(user.id, result.sourceDate),
      });
      for (const proposal of result.proposals) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.schedule(user.id, proposal.targetDate),
        });
      }
    },
  });
}

/** 大規模リスケ（AI）のプレビューを取得する。 */
export function useMajorReschedulePreview() {
  return useMutation({
    mutationFn: async () => {
      return invokeFunction<MajorReschedulePreview>("reschedule-major");
    },
  });
}

/** 大規模リスケ案を承認し、週次予算を更新する。 */
export function useApplyMajorReschedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (preview: MajorRescheduleOutput) => {
      const period = getWeekPeriod(new Date());

      for (const budget of preview.updatedBudgets) {
        const { error } = await supabase
          .from("goal_budgets")
          .update({ allocated_minutes: budget.weeklyTargetMinutes })
          .eq("user_id", user!.id)
          .eq("goal_id", budget.goalId)
          .eq("period_start", period.periodStart);

        if (error) throw error;
      }

      if (preview.recommendations.length > 0) {
        await supabase.from("alerts").insert({
          user_id: user!.id,
          goal_id: null,
          kind: "major_reschedule",
          severity: preview.status === "needs_adjustment" ? "warning" : "info",
          message: preview.summary,
          suggestions: preview.recommendations,
        });
      }

      return preview;
    },
    onSuccess: async () => {
      if (!user) return;
      const period = getWeekPeriod(new Date());
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.goalBudgets(user.id, period.periodStart),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.alerts(user.id),
        }),
      ]);
    },
  });
}

/** 今日の日付キーを返す。 */
export function todayDateKey(): string {
  return toLocalDateKey(new Date());
}
