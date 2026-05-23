/** ブロック完了記録のステータス */
export type BlockCompletionStatus = "done" | "partial" | "skipped";

/** 疲労度（1=元気 〜 5=かなり疲れ） */
export type FatigueLevel = 1 | 2 | 3 | 4 | 5;

/** ブロック完了記録の入力 */
export interface BlockCompletionInput {
  blockId: string;
  status: BlockCompletionStatus;
  /** partial の場合の実績分数 */
  actualMinutes?: number;
}

/**
 * 完了記録から実績分数を算出する。
 *
 * @param status - 完了ステータス
 * @param plannedMinutes - 予定分数
 * @param actualMinutes - partial 時の実績分数
 */
export function resolveActualMinutes(
  status: BlockCompletionStatus,
  plannedMinutes: number,
  actualMinutes?: number,
): number {
  if (status === "done") return plannedMinutes;
  if (status === "skipped") return 0;

  const partial = actualMinutes ?? 0;
  return Math.min(plannedMinutes, Math.max(0, partial));
}

/**
 * 未完了分（再配置対象）の分数を返す。
 *
 * @param plannedMinutes - 予定分数
 * @param actualMinutes - 実績分数
 */
export function remainingMinutesFromBlock(
  plannedMinutes: number,
  actualMinutes: number,
): number {
  return Math.max(0, plannedMinutes - actualMinutes);
}

/**
 * ブロック完了記録から目標・予算へ加算する分数を返す。
 * 既存の actual_minutes との差分のみ加算する（再記録に対応）。
 *
 * @param previousActualMinutes - 更新前の実績分数
 * @param newActualMinutes - 更新後の実績分数
 */
export function deltaCompletedMinutes(
  previousActualMinutes: number,
  newActualMinutes: number,
): number {
  return newActualMinutes - previousActualMinutes;
}

/**
 * スケジュール内の全ブロックが記録済みか判定する。
 *
 * @param blockStatuses - 各ブロックのステータス
 */
export function isScheduleFullyRecorded(
  blockStatuses: Array<"planned" | "done" | "partial" | "skipped" | "rescheduled">,
): boolean {
  if (blockStatuses.length === 0) return false;
  return blockStatuses.every((status) => status !== "planned");
}

/**
 * 再配置が必要なブロックか判定する。
 *
 * @param status - ブロックステータス
 * @param plannedMinutes - 予定分数
 * @param actualMinutes - 実績分数
 */
export function needsReschedule(
  status: "planned" | "done" | "partial" | "skipped" | "rescheduled",
  plannedMinutes: number,
  actualMinutes: number,
): boolean {
  if (status === "rescheduled") return false;
  if (status === "skipped") return true;
  if (status === "partial") {
    return remainingMinutesFromBlock(plannedMinutes, actualMinutes) > 0;
  }
  return false;
}

/** 疲労度の表示ラベル */
export const FATIGUE_LEVEL_LABELS: Record<FatigueLevel, string> = {
  1: "とても元気",
  2: "元気",
  3: "普通",
  4: "やや疲れ",
  5: "かなり疲れ",
};

/** ブロックステータスの表示ラベル */
export const SCHEDULED_BLOCK_STATUS_LABELS: Record<
  "planned" | "done" | "partial" | "skipped" | "rescheduled",
  string
> = {
  planned: "未記録",
  done: "完了",
  partial: "一部達成",
  skipped: "未達成",
  rescheduled: "再配置済み",
};
