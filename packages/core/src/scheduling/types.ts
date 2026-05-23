/**
 * スケジューリングドメインの型定義。
 * DB 行型（database-types）とは独立し、計算ロジックの入出力契約を表す。
 */

/** "HH:mm" または "HH:mm:ss" 形式の時刻文字列 */
export type TimeString = `${number}:${number}` | `${number}:${number}:${number}`;

/** 空き時間計算で除外される時間帯 */
export interface TimeBlock {
  startMinutes: number;
  endMinutes: number;
  label: string;
  kind: "wake_boundary" | "sleep_boundary" | "fixed" | "commute" | "routine";
}

/** 利用可能な空き時間スロット */
export interface FreeTimeSlot {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

/** 1日の起床・就寝時刻（当日変更反映後） */
export interface UserDayPreferences {
  wakeTime: TimeString;
  sleepTime: TimeString;
}

/** 生活リズム（計算ロジック入力） */
export interface LifeRoutineInput {
  id: string;
  type: string;
  label: string | null;
  preferredTime: TimeString;
  earliestTime: TimeString;
  latestTime: TimeString;
  durationMinutes: number;
  appliesTo: "weekday" | "weekend" | "both";
}

/** 固定予定（計算ロジック入力） */
export interface FixedScheduleInput {
  id: string;
  title: string;
  startTime: TimeString;
  endTime: TimeString;
  daysOfWeek: number[];
  commuteMinutes: number;
}

/** 当日変更（計算ロジック入力） */
export interface RoutineDayOverrideInput {
  targetType: "wake" | "sleep" | "routine";
  lifeRoutineId: string | null;
  action: "skip" | "modify";
  preferredTime: TimeString | null;
  earliestTime: TimeString | null;
  latestTime: TimeString | null;
  durationMinutes: number | null;
}

/** 空き時間計算の入力 */
export interface FreeTimeInput {
  date: Date;
  preferences: UserDayPreferences;
  lifeRoutines: LifeRoutineInput[];
  fixedSchedules: FixedScheduleInput[];
  dayOverrides: RoutineDayOverrideInput[];
}

/** 当日変更反映後の生活リズム */
export interface ResolvedLifeRoutine {
  id: string;
  type: string;
  label: string;
  preferredTime: TimeString;
  earliestTime: TimeString;
  latestTime: TimeString;
  durationMinutes: number;
  skipped: boolean;
}

/** 空き時間計算の結果 */
export interface FreeTimeResult {
  date: Date;
  wakeTime: TimeString;
  sleepTime: TimeString;
  blockedBlocks: TimeBlock[];
  freeSlots: FreeTimeSlot[];
  lifeRoutines: ResolvedLifeRoutine[];
}

/** DB 行から空き時間計算へ渡すための入力一式 */
export interface ScheduleDataSnapshot {
  preferences: UserDayPreferences;
  lifeRoutines: LifeRoutineInput[];
  fixedSchedules: FixedScheduleInput[];
  dayOverrides: RoutineDayOverrideInput[];
}
