import type { Tables } from "../database-types.js";
import { getDefaultPreferencesForDate } from "../scheduling/free-time.js";
import type {
  FixedScheduleInput,
  LifeRoutineInput,
  RoutineDayOverrideInput,
  ScheduleDataSnapshot,
  TimeString,
} from "../scheduling/types.js";

type UserPreferencesRow = Tables<"user_preferences">;
type LifeRoutineRow = Tables<"life_routines">;
type FixedScheduleRow = Tables<"fixed_schedules">;
type RoutineDayOverrideRow = Tables<"routine_day_overrides">;

/**
 * PostgreSQL TIME 型（"HH:mm:ss"）をドメイン用 "HH:mm" に変換する。
 */
export function trimDbTime(value: string | null | undefined): TimeString | null {
  if (!value) return null;
  return value.slice(0, 5) as TimeString;
}

/** DB 行 → 生活リズム入力 */
export function mapLifeRoutineRow(row: LifeRoutineRow): LifeRoutineInput {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    preferredTime: trimDbTime(row.preferred_time)!,
    earliestTime: trimDbTime(row.earliest_time)!,
    latestTime: trimDbTime(row.latest_time)!,
    durationMinutes: row.duration_minutes,
    appliesTo: row.applies_to,
  };
}

/** DB 行 → 固定予定入力 */
export function mapFixedScheduleRow(row: FixedScheduleRow): FixedScheduleInput {
  return {
    id: row.id,
    title: row.title,
    startTime: trimDbTime(row.start_time)!,
    endTime: trimDbTime(row.end_time)!,
    daysOfWeek: row.days_of_week,
    commuteMinutes: row.commute_minutes,
  };
}

/** DB 行 → 当日変更入力 */
export function mapDayOverrideRow(
  row: RoutineDayOverrideRow,
): RoutineDayOverrideInput {
  return {
    targetType: row.target_type,
    lifeRoutineId: row.life_routine_id,
    action: row.action,
    preferredTime: trimDbTime(row.preferred_time),
    earliestTime: trimDbTime(row.earliest_time),
    latestTime: trimDbTime(row.latest_time),
    durationMinutes: row.duration_minutes,
  };
}

/**
 * ユーザー設定 DB 行から、指定日の起床・就寝時刻を解決する。
 * 週末/平日の切り替えは getDefaultPreferencesForDate に委譲する前提の生データ変換。
 */
export function mapUserPreferencesToDayInput(
  row: UserPreferencesRow,
): {
  wakeWeekday: TimeString | null;
  wakeWeekend: TimeString | null;
  sleepWeekday: TimeString | null;
  sleepWeekend: TimeString | null;
} {
  return {
    wakeWeekday: trimDbTime(row.wake_time_weekday),
    wakeWeekend: trimDbTime(row.wake_time_weekend),
    sleepWeekday: trimDbTime(row.sleep_time_weekday),
    sleepWeekend: trimDbTime(row.sleep_time_weekend),
  };
}

/**
 * Supabase から取得した複数テーブルのデータを、空き時間計算用スナップショットに変換する。
 * UI 層での重複マッピングを防ぎ、Phase 追加時の変更箇所を一箇所に集約する。
 */
export function buildScheduleDataSnapshot(input: {
  preferences: UserPreferencesRow;
  lifeRoutines: LifeRoutineRow[];
  fixedSchedules: FixedScheduleRow[];
  dayOverrides: RoutineDayOverrideRow[];
  date: Date;
}): ScheduleDataSnapshot {
  const mapped = mapUserPreferencesToDayInput(input.preferences);

  return {
    preferences: getDefaultPreferencesForDate(
      mapped.wakeWeekday,
      mapped.wakeWeekend,
      mapped.sleepWeekday,
      mapped.sleepWeekend,
      input.date,
    ),
    lifeRoutines: input.lifeRoutines.map(mapLifeRoutineRow),
    fixedSchedules: input.fixedSchedules.map(mapFixedScheduleRow),
    dayOverrides: input.dayOverrides.map(mapDayOverrideRow),
  };
}
