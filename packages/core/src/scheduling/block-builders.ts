import { MINUTES_PER_DAY } from "./constants.js";
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
 * 1 件の固定予定からブロック（本体 + 移動時間）を構築する。
 *
 * @param offsetMinutes - 対象日座標への変換オフセット
 *   （前日開始の予定は -1440、翌日開始の予定は +1440）
 */
function buildBlocksForSchedule(
  schedule: FixedScheduleInput,
  offsetMinutes: number,
): TimeBlock[] {
  const startMinutes = parseTimeToMinutes(schedule.startTime) + offsetMinutes;
  let endMinutes = parseTimeToMinutes(schedule.endTime) + offsetMinutes;
  // 終了が開始以前の場合は日跨ぎ（夜勤等）とみなし翌日側へ延長する
  if (endMinutes <= startMinutes) {
    endMinutes += MINUTES_PER_DAY;
  }

  const blocks: TimeBlock[] = [
    {
      startMinutes,
      endMinutes,
      label: schedule.title,
      kind: "fixed",
    },
  ];

  if (schedule.commuteMinutes > 0) {
    blocks.push({
      startMinutes: endMinutes,
      endMinutes: endMinutes + schedule.commuteMinutes,
      label: `${schedule.title}（移動）`,
      kind: "commute",
    });
  }

  return blocks;
}

/**
 * 固定予定と移動時間からブロック一覧を構築する。
 * 固定予定は空き時間計算時に必ず除外される（企画書 5.2 節）。
 */
export function buildFixedScheduleBlocks(
  schedules: FixedScheduleInput[],
): TimeBlock[] {
  return schedules.flatMap((schedule) => buildBlocksForSchedule(schedule, 0));
}

/**
 * 対象日の空き時間計算に影響しうる固定予定ブロックを構築する。
 *
 * 対象日当日の予定に加え、以下も対象日座標で含める:
 * - 前日開始の日跨ぎ予定（例: 金曜 22:00〜土曜 06:00 の土曜早朝部分）
 * - 翌日の予定（就寝が日を跨ぐ場合、起床〜就寝の範囲が翌日に及ぶため）
 *
 * 範囲外のブロックは空き時間の減算時に自然に無視される。
 */
export function buildFixedScheduleBlocksForDate(
  fixedSchedules: FixedScheduleInput[],
  date: Date,
): TimeBlock[] {
  const dayOfWeek = date.getDay();
  const prevDayOfWeek = (dayOfWeek + 6) % 7;
  const nextDayOfWeek = (dayOfWeek + 1) % 7;

  const blocks: TimeBlock[] = [];

  for (const schedule of fixedSchedules) {
    if (schedule.daysOfWeek.includes(dayOfWeek)) {
      blocks.push(...buildBlocksForSchedule(schedule, 0));
    }

    // 前日開始の日跨ぎ予定は当日早朝に食い込む（対象日座標では負の開始分）
    if (schedule.daysOfWeek.includes(prevDayOfWeek)) {
      const startMinutes = parseTimeToMinutes(schedule.startTime);
      const endMinutes = parseTimeToMinutes(schedule.endTime);
      if (endMinutes <= startMinutes) {
        blocks.push(...buildBlocksForSchedule(schedule, -MINUTES_PER_DAY));
      }
    }

    // 就寝が日を跨ぐ場合に備え、翌日の予定も +1440 で含める
    if (schedule.daysOfWeek.includes(nextDayOfWeek)) {
      blocks.push(...buildBlocksForSchedule(schedule, MINUTES_PER_DAY));
    }
  }

  // 対象日の計算範囲（0〜翌日末）と交差しうるものだけ残す
  return blocks.filter(
    (block) =>
      block.endMinutes > 0 && block.startMinutes < 2 * MINUTES_PER_DAY,
  );
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
