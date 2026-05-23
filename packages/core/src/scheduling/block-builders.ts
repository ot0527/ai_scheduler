import { parseTimeToMinutes } from "./time-utils.js";
import type {
  FixedScheduleInput,
  ResolvedLifeRoutine,
  TimeBlock,
} from "./types.js";

/**
 * 指定日の曜日に該当する固定予定を抽出する。
 */
export function filterFixedSchedulesForDate(
  fixedSchedules: FixedScheduleInput[],
  date: Date,
): FixedScheduleInput[] {
  const dayOfWeek = date.getDay();
  return fixedSchedules.filter((schedule) =>
    schedule.daysOfWeek.includes(dayOfWeek),
  );
}

/**
 * 固定予定と移動時間からブロック一覧を構築する。
 * 固定予定は空き時間計算時に必ず除外される（企画書 5.2 節）。
 */
export function buildFixedScheduleBlocks(
  schedules: FixedScheduleInput[],
): TimeBlock[] {
  const blocks: TimeBlock[] = [];

  for (const schedule of schedules) {
    blocks.push({
      startMinutes: parseTimeToMinutes(schedule.startTime),
      endMinutes: parseTimeToMinutes(schedule.endTime),
      label: schedule.title,
      kind: "fixed",
    });

    if (schedule.commuteMinutes > 0) {
      const endMinutes = parseTimeToMinutes(schedule.endTime);
      blocks.push({
        startMinutes: endMinutes,
        endMinutes: endMinutes + schedule.commuteMinutes,
        label: `${schedule.title}（移動）`,
        kind: "commute",
      });
    }
  }

  return blocks;
}

/**
 * 生活リズムからブロック一覧を構築する。
 * スキップされたリズムはブロックに含めない。
 */
export function buildLifeRoutineBlocks(
  routines: ResolvedLifeRoutine[],
): TimeBlock[] {
  return routines
    .filter((routine) => !routine.skipped)
    .map((routine) => ({
      startMinutes: parseTimeToMinutes(routine.preferredTime),
      endMinutes:
        parseTimeToMinutes(routine.preferredTime) + routine.durationMinutes,
      label: routine.label,
      kind: "routine" as const,
    }));
}
