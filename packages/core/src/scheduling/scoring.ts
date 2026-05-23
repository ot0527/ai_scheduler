import type { FreeTimeSlot } from "./types.js";
import { parseTimeToMinutes } from "./time-utils.js";

/** 作業ブロックテンプレート（配置用） */
export interface WorkBlockTemplateInput {
  id: string;
  goalId: string;
  componentId: string;
  title: string;
  minMinutes: number;
  idealMinutes: number;
  maxMinutes: number;
  energy: "low" | "medium" | "high";
  preferredTime: string[];
  requiresDeepWork: boolean;
  orderType: "fixed" | "flexible" | "user_choice";
}

/** 目標別の週次予算（配置用） */
export interface GoalBudgetContext {
  goalId: string;
  goalTitle: string;
  allocatedMinutes: number;
  completedMinutesThisWeek: number;
  deadline: string;
  priority: "high" | "medium" | "low";
}

/** スコアリング重み（企画書 9.2 節） */
export const SCORING_WEIGHTS = {
  budgetShortfall: 0.3,
  deadlineProximity: 0.2,
  slotCompatibility: 0.2,
  focusTimeMatch: 0.15,
  fatigue: 0.1,
  pastPreference: 0.05,
} as const;

const PRIORITY_SCORE: Record<"high" | "medium" | "low", number> = {
  high: 1,
  medium: 0.66,
  low: 0.33,
};

/**
 * 時刻（分）が属する時間帯ラベルを返す。
 *
 * @param startMinutes - スロット開始（0 時起点）
 */
export function getTimePeriodFromMinutes(startMinutes: number): string {
  const hour = Math.floor((startMinutes % (24 * 60)) / 60);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

/**
 * 空きスロットに配置可能な作業時間（分）を算出する。
 *
 * @param slot - 空き時間
 * @param template - 作業ブロック
 */
export function fitBlockDuration(slot: FreeTimeSlot, template: WorkBlockTemplateInput): number {
  const slotMinutes = slot.durationMinutes;
  if (slotMinutes < template.minMinutes) return 0;

  const ideal = Math.min(template.idealMinutes, slotMinutes);
  if (ideal >= template.minMinutes && ideal <= template.maxMinutes) {
    return ideal;
  }

  const capped = Math.min(template.maxMinutes, slotMinutes);
  return capped >= template.minMinutes ? capped : 0;
}

/**
 * 配置候補のスコアを計算する（0〜1）。
 *
 * @param slot - 空き時間
 * @param template - 作業ブロック
 * @param budget - 目標予算
 * @param focusTimes - ユーザーの集中時間帯
 * @param todayKey - 基準日
 */
export function scorePlacementCandidate(
  slot: FreeTimeSlot,
  template: WorkBlockTemplateInput,
  budget: GoalBudgetContext,
  focusTimes: string[],
  todayKey: string,
): number {
  const duration = fitBlockDuration(slot, template);
  if (duration === 0) return 0;

  const remainingBudget =
    budget.allocatedMinutes - budget.completedMinutesThisWeek;
  const budgetShortfallScore =
    remainingBudget <= 0
      ? 0
      : Math.min(1, remainingBudget / Math.max(budget.allocatedMinutes, 1));

  const deadline = new Date(budget.deadline + "T12:00:00");
  const today = new Date(todayKey + "T12:00:00");
  const daysLeft = Math.max(
    0,
    Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const deadlineScore =
    daysLeft <= 7 ? 1 : daysLeft <= 30 ? 0.7 : daysLeft <= 90 ? 0.4 : 0.2;

  const period = getTimePeriodFromMinutes(slot.startMinutes);
  const slotCompatibilityScore =
    template.preferredTime.length === 0 || template.preferredTime.includes(period)
      ? 1
      : 0.3;

  const slotStartTime = `${String(Math.floor(slot.startMinutes / 60)).padStart(2, "0")}:${String(slot.startMinutes % 60).padStart(2, "0")}`;
  const focusTimeMatchScore = focusTimes.some((focusTime) => {
    const focusMinutes = parseTimeToMinutes(focusTime);
    return Math.abs(focusMinutes - slot.startMinutes) <= 60;
  })
    ? 1
    : template.requiresDeepWork
      ? 0.2
      : 0.5;

  const fatigueScore = template.energy === "low" ? 0.8 : 0.6;
  const pastPreferenceScore = 0.5;
  const priorityBoost = PRIORITY_SCORE[budget.priority];

  const base =
    SCORING_WEIGHTS.budgetShortfall * budgetShortfallScore +
    SCORING_WEIGHTS.deadlineProximity * deadlineScore +
    SCORING_WEIGHTS.slotCompatibility * slotCompatibilityScore +
    SCORING_WEIGHTS.focusTimeMatch * focusTimeMatchScore +
    SCORING_WEIGHTS.fatigue * fatigueScore +
    SCORING_WEIGHTS.pastPreference * pastPreferenceScore;

  return Math.min(1, base * (0.7 + priorityBoost * 0.1));
}

/** スコア付き配置候補 */
export interface ScoredPlacementCandidate {
  slotIndex: number;
  templateId: string;
  goalId: string;
  score: number;
  plannedMinutes: number;
  startMinutes: number;
  endMinutes: number;
}

/**
 * 全候補のスコアを計算する。
 *
 * @param freeSlots - 空き時間一覧
 * @param templates - 作業ブロック一覧
 * @param budgets - 目標予算一覧
 * @param focusTimes - 集中時間帯
 * @param todayKey - 基準日
 */
export function buildScoredCandidates(
  freeSlots: FreeTimeSlot[],
  templates: WorkBlockTemplateInput[],
  budgets: GoalBudgetContext[],
  focusTimes: string[],
  todayKey: string,
): ScoredPlacementCandidate[] {
  const budgetByGoal = new Map(budgets.map((budget) => [budget.goalId, budget]));
  const candidates: ScoredPlacementCandidate[] = [];

  freeSlots.forEach((slot, slotIndex) => {
    for (const template of templates) {
      const budget = budgetByGoal.get(template.goalId);
      if (!budget) continue;

      const plannedMinutes = fitBlockDuration(slot, template);
      if (plannedMinutes === 0) continue;

      const score = scorePlacementCandidate(
        slot,
        template,
        budget,
        focusTimes,
        todayKey,
      );
      if (score <= 0) continue;

      candidates.push({
        slotIndex,
        templateId: template.id,
        goalId: template.goalId,
        score,
        plannedMinutes,
        startMinutes: slot.startMinutes,
        endMinutes: slot.startMinutes + plannedMinutes,
      });
    }
  });

  return candidates.sort((a, b) => b.score - a.score);
}
