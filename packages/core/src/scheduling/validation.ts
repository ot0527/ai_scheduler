import type { FreeTimeResult } from "./types.js";
import type { PlacedBlock } from "./placement.js";
import { mergeOverlappingBlocks } from "./time-utils.js";

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

  blocks.forEach((block, index) => {
    const wakeMinutes = parseWakeSleep(freeTime.wakeTime);
    const sleepMinutes = parseWakeSleep(freeTime.sleepTime);

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

  const blockRanges = blocks.map((block) => ({
    startMinutes: block.startMinutes,
    endMinutes: block.endMinutes,
  }));
  const merged = mergeOverlappingBlocks(blockRanges);
  if (merged.length !== blockRanges.length) {
    issues.push({
      code: "overlap",
      message: "作業ブロック同士が重複しています",
    });
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
