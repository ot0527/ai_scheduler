import { buildScoredCandidates } from "./scoring.js";
import type { FreeTimeResult, FreeTimeSlot } from "./types.js";
import type { GoalBudgetContext, WorkBlockTemplateInput } from "./scoring.js";

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
 */
export function generateDailyPlacement(
  freeTime: FreeTimeResult,
  templates: WorkBlockTemplateInput[],
  budgets: GoalBudgetContext[],
  focusTimes: string[],
  todayKey: string,
): DailyPlacementResult {
  const usedSlots = new Set<number>();
  const usedTemplates = new Set<string>();
  const usedMinutesByGoal: Record<string, number> = {};
  const blocks: PlacedBlock[] = [];

  const remainingBudgetByGoal = new Map(
    budgets.map((budget) => [
      budget.goalId,
      budget.allocatedMinutes - budget.completedMinutesThisWeek,
    ]),
  );

  const candidates = buildScoredCandidates(
    freeTime.freeSlots,
    templates,
    budgets,
    focusTimes,
    todayKey,
  );

  for (const candidate of candidates) {
    if (usedSlots.has(candidate.slotIndex)) continue;
    if (usedTemplates.has(candidate.templateId)) continue;

    const remaining = remainingBudgetByGoal.get(candidate.goalId) ?? 0;
    if (remaining < candidate.plannedMinutes) continue;

    const template = templates.find((item) => item.id === candidate.templateId);
    if (!template) continue;

    const slot = freeTime.freeSlots[candidate.slotIndex];
    if (!slot || !fitsInSlot(slot, candidate.startMinutes, candidate.endMinutes)) {
      continue;
    }

    usedSlots.add(candidate.slotIndex);
    usedTemplates.add(candidate.templateId);
    usedMinutesByGoal[candidate.goalId] =
      (usedMinutesByGoal[candidate.goalId] ?? 0) + candidate.plannedMinutes;
    remainingBudgetByGoal.set(
      candidate.goalId,
      remaining - candidate.plannedMinutes,
    );

    blocks.push({
      workBlockTemplateId: template.id,
      goalId: template.goalId,
      componentId: template.componentId,
      title: template.title,
      startMinutes: candidate.startMinutes,
      endMinutes: candidate.endMinutes,
      plannedMinutes: candidate.plannedMinutes,
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

function fitsInSlot(slot: FreeTimeSlot, start: number, end: number): boolean {
  return start >= slot.startMinutes && end <= slot.endMinutes;
}

export type { WorkBlockTemplateInput, GoalBudgetContext };
