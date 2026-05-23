import type { Tables } from "../database-types.js";
import { calculateFreeTime, getDefaultPreferencesForDate } from "./free-time.js";
import { mapUserPreferencesToDayInput } from "../mappers/schedule-input.js";
import type {
  FixedScheduleInput,
  LifeRoutineInput,
} from "./types.js";
import { getWeekPeriod } from "./week-utils.js";

type UserPreferencesRow = Tables<"user_preferences">;

/** 週次空き時間計算の入力 */
export interface WeeklyFreeTimeInput {
  preferencesRow: UserPreferencesRow;
  lifeRoutines: LifeRoutineInput[];
  fixedSchedules: FixedScheduleInput[];
}

/**
 * 指定週の合計空き時間（分）を算出する。
 * 日次の当日変更は週次計画には含めない。
 *
 * @param input - ユーザー設定・生活リズム・固定予定
 * @param referenceDate - 週を特定する基準日
 */
export function calculateWeeklyAvailableMinutes(
  input: WeeklyFreeTimeInput,
  referenceDate: Date,
): number {
  const mapped = mapUserPreferencesToDayInput(input.preferencesRow);
  const { days } = getWeekPeriod(referenceDate);

  return days.reduce((total, day) => {
    const preferences = getDefaultPreferencesForDate(
      mapped.wakeWeekday,
      mapped.wakeWeekend,
      mapped.sleepWeekday,
      mapped.sleepWeekend,
      day,
    );

    const result = calculateFreeTime({
      date: day,
      preferences,
      lifeRoutines: input.lifeRoutines,
      fixedSchedules: input.fixedSchedules,
      dayOverrides: [],
    });

    return (
      total +
      result.freeSlots.reduce((sum, slot) => sum + slot.durationMinutes, 0)
    );
  }, 0);
}
