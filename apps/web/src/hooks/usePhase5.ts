import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseNotificationSettings,
  type NotificationSettings,
} from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";

/** 通知設定を取得する。 */
export function useNotificationSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.notificationSettings(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("notification_settings")
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      return parseNotificationSettings(data.notification_settings);
    },
  });
}

/** 通知設定を保存する。 */
export function useSaveNotificationSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      const { error } = await supabase
        .from("user_preferences")
        .update({ notification_settings: settings })
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      if (!user) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.notificationSettings(user.id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.userPreferences(user.id),
      });
    },
  });
}

/** 振り返り履歴（reviewed_at があるスケジュール）を取得する。 */
export function useReviewHistory(limit = 14) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.reviewHistory(user?.id ?? "", limit),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("target_date, fatigue_level, review_note, reviewed_at, status")
        .eq("user_id", user!.id)
        .not("reviewed_at", "is", null)
        .order("reviewed_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
  });
}
