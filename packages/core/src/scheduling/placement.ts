import { buildScoredCandidates, fitBlockDuration } from "./scoring.js";
import type { FreeTimeResult, FreeTimeSlot } from "./types.js";
import type {
  GoalBudgetContext,
  ScoringExecutionContext,
  WorkBlockTemplateInput,
} from "./scoring.js";

/** 配置された作業ブロック */
export interface PlacedBlock {
  workBlockTemplateId: string;
  goalId: string;
  componentId: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  plannedMinutes: number;
  orderType: "fixed" | "flexible" | "user_choice";
  score: number;
}

/** 日次配置結果 */
export interface DailyPlacementResult {
  blocks: PlacedBlock[];
  usedMinutesByGoal: Record<string, number>;
  unplacedTemplateIds: string[];
}

/**
 * 貪欲法で空き時間に作業ブロックを仮配置する。
 *
 * @param freeTime - 空き時間計算結果
 * @param templates - 作業ブロックテンプレート
 * @param budgets - 週次予算コンテキスト
 * @param focusTimes - 集中時間帯
 * @param todayKey - 基準日（yyyy-MM-dd）
 * @param executionContext - 実行実績コンテキスト
 */
export function generateDailyPlacement(
  freeTime: FreeTimeResult,
  templates: WorkBlockTemplateInput[],
  budgets: GoalBudgetContext[],
  focusTimes: string[],
  todayKey: string,
  executionContext?: ScoringExecutionContext,
): DailyPlacementResult {
  /** スロットごとの配置済み末尾（次に配置可能な開始分） */
  const slotCursors = new Map<number, number>();
  const usedTemplates = new Set<string>();
  const usedMinutesByGoal: Record<string, number> = {};
  const blocks: PlacedBlock[] = [];

  const remainingBudgetByGoal = new Map(
    budgets.map((budget) => [
      budget.goalId,
      budget.allocatedMinutes - budget.completedMinutesThisWeek,
    ]),
  );
  const templateById = new Map(
    templates.map((template) => [template.id, template]),
  );

  const candidates = buildScoredCandidates(
    freeTime.freeSlots,
    templates,
    budgets,
    focusTimes,
    todayKey,
    executionContext,
  );

  for (const candidate of candidates) {
    if (usedTemplates.has(candidate.templateId)) continue;

    const template = templateById.get(candidate.templateId);
    if (!template) continue;

    const slot = freeTime.freeSlots[candidate.slotIndex];
    if (!slot) continue;

    // スロット内の残り区間（配置済みブロックの後ろ）に収まる分数を再計算する
    const cursor = slotCursors.get(candidate.slotIndex) ?? slot.startMinutes;
    const remainingSlot: FreeTimeSlot = {
      startMinutes: cursor,
      endMinutes: slot.endMinutes,
      durationMinutes: slot.endMinutes - cursor,
    };
    const plannedMinutes = fitBlockDuration(remainingSlot, template);
    if (plannedMinutes === 0) continue;

    const remaining = remainingBudgetByGoal.get(candidate.goalId) ?? 0;
    if (remaining < plannedMinutes) continue;

    const startMinutes = cursor;
    const endMinutes = cursor + plannedMinutes;

    slotCursors.set(candidate.slotIndex, endMinutes);
    usedTemplates.add(candidate.templateId);
    usedMinutesByGoal[candidate.goalId] =
      (usedMinutesByGoal[candidate.goalId] ?? 0) + plannedMinutes;
    remainingBudgetByGoal.set(candidate.goalId, remaining - plannedMinutes);

    blocks.push({
      workBlockTemplateId: template.id,
      goalId: template.goalId,
      componentId: template.componentId,
      title: template.title,
      startMinutes,
      endMinutes,
      plannedMinutes,
      orderType: template.orderType,
      score: candidate.score,
    });
  }

  blocks.sort((a, b) => a.startMinutes - b.startMinutes);

  const unplacedTemplateIds = templates
    .filter((template) => !usedTemplates.has(template.id))
    .map((template) => template.id);

  return { blocks, usedMinutesByGoal, unplacedTemplateIds };
}

export type { WorkBlockTemplateInput, GoalBudgetContext, ScoringExecutionContext };
