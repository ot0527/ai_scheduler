import {
  buildFixedScheduleBlocksForDate,
  buildLifeRoutineBlocks,
} from "./block-builders.js";
import {
  DEFAULT_SLEEP_TIME,
  DEFAULT_WAKE_TIME,
  MINUTES_PER_DAY,
} from "./constants.js";
import { formatDuration, formatTimeRange } from "./formatters.js";
import {
  resolveLifeRoutineForDay,
  resolveWakeSleepTimes,
} from "./overrides.js";
import {
  appliesToDate,
  isWeekend,
  mergeOverlappingBlocks,
  parseTimeToMinutes,
  subtractBlocksFromRange,
} from "./time-utils.js";
import type {
  FreeTimeInput,
  FreeTimeResult,
  TimeString,
  UserDayPreferences,
} from "./types.js";

export { formatDuration, formatTimeRange };

/**
 * 指定日の空き時間を計算する（Phase 1 の中核ロジック）。
 *
 * 処理順序（企画書 8.2 節・技術選定 8.2 節）:
 * 1. 起床〜就寝の範囲を確定（当日変更を反映）
 * 2. 固定予定をブロック
 * 3. 生活リズムをブロック
 * 4. 残りを空き時間スロットとして返却
 */
export function calculateFreeTime(input: FreeTimeInput): FreeTimeResult {
  const { date, preferences, lifeRoutines, fixedSchedules, dayOverrides } =
    input;

  const { wakeTime, sleepTime } = resolveWakeSleepTimes(
    preferences,
    dayOverrides,
  );

  const activeRoutines = lifeRoutines
    .filter((routine) => appliesToDate(routine.appliesTo, date))
    .map((routine) => resolveLifeRoutineForDay(routine, dayOverrides));

  const blockedBlocks = [
    ...buildFixedScheduleBlocksForDate(fixedSchedules, date),
    ...buildLifeRoutineBlocks(activeRoutines),
  ].sort((a, b) => a.startMinutes - b.startMinutes);

  let dayStart = parseTimeToMinutes(wakeTime);
  let dayEnd = parseTimeToMinutes(sleepTime);
  if (dayEnd <= dayStart) {
    dayEnd += MINUTES_PER_DAY;
  }

  const freeSlots = subtractBlocksFromRange(
    dayStart,
    dayEnd,
    mergeOverlappingBlocks(blockedBlocks),
  );

  return {
    date,
    wakeTime,
    sleepTime,
    blockedBlocks,
    freeSlots,
    lifeRoutines: activeRoutines,
  };
}

/**
 * ユーザー設定から、指定日の起床・就寝時刻を解決する。
 * 未設定時はデフォルト値にフォールバックする。
 */
export function getDefaultPreferencesForDate(
  wakeWeekday: TimeString | null,
  wakeWeekend: TimeString | null,
  sleepWeekday: TimeString | null,
  sleepWeekend: TimeString | null,
  date: Date,
): UserDayPreferences {
  const weekend = isWeekend(date);
  return {
    wakeTime:
      (weekend ? wakeWeekend : wakeWeekday) ??
      (DEFAULT_WAKE_TIME as TimeString),
    sleepTime:
      (weekend ? sleepWeekend : sleepWeekday) ??
      (DEFAULT_SLEEP_TIME as TimeString),
  };
}
