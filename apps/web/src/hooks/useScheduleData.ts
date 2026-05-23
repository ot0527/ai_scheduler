import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/hooks/useAuth";

/** ユーザーの基本設定を取得する。 */
export function useUserPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.userPreferences(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

/** ユーザーの生活リズム一覧を取得する。 */
export function useLifeRoutines() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.lifeRoutines(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("life_routines")
        .select("*")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

/** ユーザーの固定予定一覧を取得する。 */
export function useFixedSchedules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.fixedSchedules(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_schedules")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

/** 指定日の当日変更一覧を取得する。 */
export function useDayOverrides(date: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.dayOverrides(user?.id ?? "", date),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_day_overrides")
        .select("*")
        .eq("user_id", user!.id)
        .eq("target_date", date);

      if (error) throw error;
      return data;
    },
  });
}

/** ユーザーのプロフィールを取得する。 */
export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.profile(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

/** 平日の起床・就寝が設定済みかどうかを判定する。 */
export function isOnboardingComplete(
  prefs:
    | {
        wake_time_weekday: string | null;
        sleep_time_weekday: string | null;
      }
    | null
    | undefined,
): boolean {
  return !!(prefs?.wake_time_weekday && prefs?.sleep_time_weekday);
}

/**
 * 初回オンボーディング完了判定。
 * 平日の起床・就寝が未設定なら /onboarding へ誘導する。
 */
export function useSetupComplete() {
  const prefsQuery = useUserPreferences();

  const isComplete = isOnboardingComplete(prefsQuery.data);

  return {
    ...prefsQuery,
    isComplete,
  };
}
