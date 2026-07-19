import type { Tables } from "../database-types.js";
import type { PlacedBlock } from "../scheduling/placement.js";
import { formatMinutesToTime } from "../scheduling/time-utils.js";

export type GoalBudgetRow = Tables<"goal_budgets">;
export type ScheduleRow = Tables<"schedules">;
export type ScheduledBlockRow = Tables<"scheduled_blocks">;
export type AlertRow = Tables<"alerts">;

/** 時間予算ステータスの表示ラベル */
export const GOAL_BUDGET_STATUS_LABELS: Record<
  GoalBudgetRow["status"],
  string
> = {
  on_track: "順調",
  behind: "やや不足",
  at_risk: "要注意",
  over_allocated: "超過割当",
};

/** スケジュールステータスの表示ラベル */
export const SCHEDULE_STATUS_LABELS: Record<ScheduleRow["status"], string> = {
  draft: "下書き",
  approved: "承認済み",
  in_progress: "実行中",
  completed: "完了",
  cancelled: "キャンセル",
};

/**
 * 配置結果を DB 挿入用の scheduled_blocks 行へ変換する。
 *
 * 就寝が日を跨ぐ場合、終了分が 1440 以上のブロック（例: 23:30〜24:30）は
 * end_time が翌日時刻（00:30）へ正規化される。DB 制約は start <> end のみで、
 * end < start の行は日跨ぎとして解釈する（planned_minutes が正しい分数を持つ）。
 *
 * @param scheduleId - 親スケジュール ID
 * @param blocks - 配置ブロック
 */
export function mapPlacedBlocksToInsertRows(
  scheduleId: string,
  blocks: PlacedBlock[],
): Array<Omit<ScheduledBlockRow, "id" | "created_at" | "updated_at" | "actual_minutes" | "status" | "selected_menu_item">> {
  return blocks.map((block, index) => ({
    schedule_id: scheduleId,
    work_block_template_id: block.workBlockTemplateId,
    goal_id: block.goalId,
    component_id: block.componentId,
    title: block.title,
    start_time: `${formatMinutesToTime(block.startMinutes)}:00`,
    end_time: `${formatMinutesToTime(block.endMinutes)}:00`,
    planned_minutes: block.plannedMinutes,
    sort_order: index,
  }));
}

/**
 * scheduled_blocks の start_time / end_time を分に変換する。
 *
 * @param time - PostgreSQL TIME 文字列
 */
export function parseDbTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * スケジュールとブロックを UI 表示用にまとめる。
 */
export interface ScheduleWithBlocks {
  schedule: ScheduleRow;
  blocks: ScheduledBlockRow[];
}

/**
 * スケジュール行とブロック行を結合する。
 *
 * @param schedule - スケジュール行
 * @param blocks - ブロック行
 */
export function buildScheduleWithBlocks(
  schedule: ScheduleRow,
  blocks: ScheduledBlockRow[],
): ScheduleWithBlocks {
  return {
    schedule,
    blocks: [...blocks].sort((a, b) => a.sort_order - b.sort_order),
  };
}
