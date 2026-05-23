import type { Tables } from "../database-types.js";
import type { GoalDecomposeOutput } from "../ai/schemas/goal-decompose.js";

export type GoalRow = Tables<"goals">;
export type GoalComponentRow = Tables<"goal_components">;
export type WorkBlockTemplateRow = Tables<"work_block_templates">;

export interface GoalWithRelations {
  goal: GoalRow;
  components: GoalComponentRow[];
  workBlocks: WorkBlockTemplateRow[];
}

/**
 * 目標と関連データを UI 表示用にまとめる。
 *
 * @param goal - 目標行
 * @param components - 構成要素行
 * @param workBlocks - 作業ブロック行
 */
export function buildGoalWithRelations(
  goal: GoalRow,
  components: GoalComponentRow[],
  workBlocks: WorkBlockTemplateRow[],
): GoalWithRelations {
  return {
    goal,
    components: [...components].sort((a, b) => a.sort_order - b.sort_order),
    workBlocks: [...workBlocks].sort((a, b) => a.sort_order - b.sort_order),
  };
}

/**
 * AI 分解結果を DB 挿入用の行データへ変換する。
 * component 名 → id のマッピングは呼び出し側で行う。
 *
 * @param goalId - 親目標 ID
 * @param output - 検証済み AI 出力
 */
export function mapDecomposeOutputToInsertRows(goalId: string, output: GoalDecomposeOutput) {
  const components = output.components.map((component, index) => ({
    goal_id: goalId,
    name: component.name,
    estimated_minutes: component.estimatedMinutes,
    priority: component.priority,
    phase: component.phase,
    recommended_sessions_per_week: component.recommendedSessionsPerWeek ?? null,
    sort_order: index,
  }));

  const componentNameToIndex = new Map(
    output.components.map((component, index) => [component.name.toLowerCase(), index]),
  );

  const workBlocks = output.workBlocks.map((block, index) => {
    const componentIndex = componentNameToIndex.get(block.component.toLowerCase());
    if (componentIndex === undefined) {
      throw new Error(`Unknown component reference: ${block.component}`);
    }

    return {
      goal_id: goalId,
      component_index: componentIndex,
      title: block.title,
      min_minutes: block.minMinutes,
      ideal_minutes: block.idealMinutes,
      max_minutes: block.maxMinutes,
      energy: block.energy,
      is_splittable: block.isSplittable,
      preferred_time: block.preferredTime,
      requires_deep_work: block.requiresDeepWork,
      context_switch_cost: block.contextSwitchCost,
      order_type: block.orderType,
      time_menus: block.timeMenus ?? [],
      sort_order: index,
    };
  });

  return {
    goalUpdate: {
      estimated_total_minutes: output.goal.estimatedTotalMinutes,
      feasibility: output.goal.feasibility,
      ai_summary: output.goal.summary,
      status: "active" as const,
    },
    components,
    workBlocks,
  };
}

/**
 * 分数を「X時間Y分」形式へ変換する。
 *
 * @param minutes - 分数
 */
export function formatMinutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}
