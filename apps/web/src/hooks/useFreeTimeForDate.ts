import { useMemo } from "react";
import {
  buildScheduleDataSnapshot,
  calculateFreeTime,
} from "@ai-scheduler/core";
import {
  useDayOverrides,
  useFixedSchedules,
  useLifeRoutines,
  useUserPreferences,
} from "@/hooks/useScheduleData";

/**
 * 指定日の空き時間計算結果を取得する。
 * DB 取得（React Query）とドメイン計算（core）の境界をこの Hook に集約する。
 */
export function useFreeTimeForDate(date: Date) {
  const dateKey = useMemo(() => formatDateKey(date), [date]);

  const prefsQuery = useUserPreferences();
  const routinesQuery = useLifeRoutines();
  const fixedQuery = useFixedSchedules();
  const overridesQuery = useDayOverrides(dateKey);

  const isLoading =
    prefsQuery.isLoading ||
    routinesQuery.isLoading ||
    fixedQuery.isLoading ||
    overridesQuery.isLoading;

  const result = useMemo(() => {
    const prefs = prefsQuery.data;
    if (!prefs) return null;

    const snapshot = buildScheduleDataSnapshot({
      preferences: prefs,
      lifeRoutines: routinesQuery.data ?? [],
      fixedSchedules: fixedQuery.data ?? [],
      dayOverrides: overridesQuery.data ?? [],
      date,
    });

    return calculateFreeTime({
      date,
      ...snapshot,
    });
  }, [
    prefsQuery.data,
    routinesQuery.data,
    fixedQuery.data,
    overridesQuery.data,
    date,
  ]);

  return {
    result,
    isLoading,
    dateKey,
    queries: {
      prefsQuery,
      routinesQuery,
      fixedQuery,
      overridesQuery,
    },
  };
}

/** Date → "YYYY-MM-DD"（ローカルタイムゾーン） */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
