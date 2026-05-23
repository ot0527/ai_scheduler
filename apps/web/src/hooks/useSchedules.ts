import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScheduleRow, ScheduledBlockRow } from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { toLocalDateKey } from "@/hooks/useBudgets";
import { invokeFunction } from "@/lib/edge-functions";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";

export interface ScheduleWithBlocks {
  schedule: ScheduleRow;
  blocks: ScheduledBlockRow[];
}

/** 指定日のスケジュールとブロックを取得する。 */
export function useScheduleForDate(date: Date) {
  const { user } = useAuth();
  const dateKey = toLocalDateKey(date);

  return useQuery({
    queryKey: queryKeys.schedule(user?.id ?? "", dateKey),
    enabled: !!user,
    queryFn: async (): Promise<ScheduleWithBlocks | null> => {
      const { data: schedule, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("user_id", user!.id)
        .eq("target_date", dateKey)
        .maybeSingle();

      if (error) throw error;
      if (!schedule) return null;

      const { data: blocks, error: blocksError } = await supabase
        .from("scheduled_blocks")
        .select("*")
        .eq("schedule_id", schedule.id)
        .order("sort_order", { ascending: true });

      if (blocksError) throw blocksError;

      return { schedule, blocks: blocks ?? [] };
    },
  });
}

/** 日次スケジュールを Edge Function で生成する。 */
export function useGenerateSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (targetDate?: string) => {
      return invokeFunction<{
        schedule: ScheduleRow;
        blocks: ScheduledBlockRow[];
      }>("schedule-generate", { body: { targetDate } });
    },
    onSuccess: async (_, targetDate) => {
      if (!user) return;
      const dateKey = targetDate ?? toLocalDateKey(new Date());
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(user.id, dateKey),
      });
    },
  });
}

/** draft スケジュールを承認する。 */
export function useApproveSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { data, error } = await supabase
        .from("schedules")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", scheduleId)
        .eq("user_id", user!.id)
        .eq("status", "draft")
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

/** DB TIME 文字列を HH:mm 表示に変換する。 */
export function formatDbTime(time: string): string {
  return time.slice(0, 5);
}
