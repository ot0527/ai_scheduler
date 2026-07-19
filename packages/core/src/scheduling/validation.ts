import { MINUTES_PER_DAY } from "./constants.js";
import type { FreeTimeResult } from "./types.js";
import type { PlacedBlock } from "./placement.js";

/** 検証エラー */
export interface ScheduleValidationIssue {
  code: "overlap" | "out_of_bounds" | "fixed_conflict";
  message: string;
  blockIndex?: number;
}

/**
 * 配置ブロックが生活リズム・固定予定と衝突しないか検証する。
 *
 * @param freeTime - 空き時間計算結果
 * @param blocks - 配置ブロック
 */
export function validatePlacedBlocks(
  freeTime: FreeTimeResult,
  blocks: PlacedBlock[],
): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = [];

  // calculateFreeTime と同じ規則で日跨ぎ（就寝が起床以前）を正規化する
  const wakeMinutes = parseWakeSleep(freeTime.wakeTime);
  let sleepMinutes = parseWakeSleep(freeTime.sleepTime);
  if (sleepMinutes <= wakeMinutes) {
    sleepMinutes += MINUTES_PER_DAY;
  }

  blocks.forEach((block, index) => {
    if (block.startMinutes < wakeMinutes || block.endMinutes > sleepMinutes) {
      issues.push({
        code: "out_of_bounds",
        message: "起床〜就寝の範囲外に配置されています",
        blockIndex: index,
      });
    }

    for (const blocked of freeTime.blockedBlocks) {
      if (
        blocked.kind === "fixed" &&
        rangesOverlap(
          block.startMinutes,
          block.endMinutes,
          blocked.startMinutes,
          blocked.endMinutes,
        )
      ) {
        issues.push({
          code: "fixed_conflict",
          message: `固定予定「${blocked.label}」と衝突しています`,
          blockIndex: index,
        });
      }
    }
  });

  // 隣接（前ブロックの終了 = 次ブロックの開始）は重複ではないため、
  // mergeOverlappingBlocks（隣接も結合する）は使わず真の重なりのみ検出する
  const sortedRanges = blocks
    .map((block) => ({
      startMinutes: block.startMinutes,
      endMinutes: block.endMinutes,
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);
  for (let i = 1; i < sortedRanges.length; i++) {
    if (sortedRanges[i]!.startMinutes < sortedRanges[i - 1]!.endMinutes) {
      issues.push({
        code: "overlap",
        message: "作業ブロック同士が重複しています",
      });
      break;
    }
  }

  return issues;
}

function parseWakeSleep(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && endA > startB;
}

/**
 * 配置が有効かどうかを判定する。
 *
 * @param freeTime - 空き時間計算結果
 * @param blocks - 配置ブロック
 */
export function isValidPlacement(freeTime: FreeTimeResult, blocks: PlacedBlock[]): boolean {
  return validatePlacedBlocks(freeTime, blocks).length === 0;
}
