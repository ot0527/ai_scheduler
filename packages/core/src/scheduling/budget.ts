import { calculateWeeksRemaining } from "./week-utils.js";

/** 目標優先度 */
export type GoalPriority = "high" | "medium" | "low";

/** 時間予算の状態 */
export type GoalBudgetStatus = "on_track" | "behind" | "at_risk" | "over_allocated";

/** 週次予算計算の入力（1 目標分） */
export interface GoalBudgetCalculationInput {
  goalId: string;
  title: string;
  deadline: string;
  priority: GoalPriority;
  estimatedTotalMinutes: number;
  completedMinutes: number;
  weeklyAvailableMinutes: number;
  todayKey: string;
}

/** 週次予算計算の中間結果 */
export interface GoalWeeklyRequirement {
  goalId: string;
  title: string;
  priority: GoalPriority;
  requiredMinutes: number;
  weeksRemaining: number;
  remainingMinutes: number;
  weeklyAvailableMinutes: number;
}

/** 配分後の週次予算 */
export interface AllocatedGoalBudget {
  goalId: string;
  title: string;
  requiredMinutes: number;
  allocatedMinutes: number;
  status: GoalBudgetStatus;
  warningMessage: string | null;
}

/** 週次予算計算の全体結果 */
export interface WeeklyBudgetResult {
  periodStart: string;
  periodEnd: string;
  availableWeeklyMinutes: number;
  totalRequiredMinutes: number;
  budgets: AllocatedGoalBudget[];
  shortageMinutes: number;
  suggestions: string[];
}

const PRIORITY_WEIGHT: Record<GoalPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * 1 目標の週あたり必要時間を計算する。
 *
 * @param input - 目標情報
 */
export function calculateWeeklyRequired(input: GoalBudgetCalculationInput): GoalWeeklyRequirement {
  const remainingMinutes = Math.max(
    0,
    input.estimatedTotalMinutes - input.completedMinutes,
  );
  const weeksRemaining = calculateWeeksRemaining(input.todayKey, input.deadline);
  const requiredMinutes =
    remainingMinutes === 0
      ? 0
      : Math.ceil(remainingMinutes / weeksRemaining);

  return {
    goalId: input.goalId,
    title: input.title,
    priority: input.priority,
    requiredMinutes,
    weeksRemaining,
    remainingMinutes,
    weeklyAvailableMinutes: input.weeklyAvailableMinutes,
  };
}

/**
 * 配分比率から時間予算ステータスを判定する。
 *
 * @param required - 必要時間
 * @param allocated - 割当時間
 */
export function determineBudgetStatus(
  required: number,
  allocated: number,
): GoalBudgetStatus {
  if (required === 0) return "on_track";
  if (allocated > required) return "over_allocated";
  const ratio = allocated / required;
  if (ratio >= 0.95) return "on_track";
  if (ratio >= 0.7) return "behind";
  return "at_risk";
}

/**
 * 複数目標の週次時間を按分する。
 *
 * @param requirements - 各目標の必要時間
 * @param availableWeeklyMinutes - 今週の利用可能時間（分）
 */
export function allocateWeeklyBudgets(
  requirements: GoalWeeklyRequirement[],
  availableWeeklyMinutes: number,
): WeeklyBudgetResult {
  const totalRequired = requirements.reduce((sum, item) => sum + item.requiredMinutes, 0);
  const suggestions: string[] = [];

  if (requirements.length === 0) {
    return {
      periodStart: "",
      periodEnd: "",
      availableWeeklyMinutes,
      totalRequiredMinutes: 0,
      budgets: [],
      shortageMinutes: 0,
      suggestions,
    };
  }

  let budgets: AllocatedGoalBudget[];

  if (totalRequired <= availableWeeklyMinutes) {
    budgets = requirements.map((item) => ({
      goalId: item.goalId,
      title: item.title,
      requiredMinutes: item.requiredMinutes,
      allocatedMinutes: item.requiredMinutes,
      status: determineBudgetStatus(item.requiredMinutes, item.requiredMinutes),
      warningMessage: null,
    }));
  } else {
    const shortage = totalRequired - availableWeeklyMinutes;
    suggestions.push(
      `今週の自由時間が ${Math.ceil(shortage / 60)} 時間不足しています。`,
    );
    suggestions.push("優先度の低い目標の期限を延ばすことを検討してください。");
    suggestions.push("平日に 30 分追加する、または休日にまとまった時間を確保してください。");

    const weights = requirements.map((item) => {
      const urgencyBoost = item.weeksRemaining <= 4 ? 1.5 : 1;
      return PRIORITY_WEIGHT[item.priority] * urgencyBoost;
    });
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);

    budgets = requirements.map((item, index) => {
      const weight = weights[index] ?? 1;
      const share = totalWeight > 0 ? weight / totalWeight : 1 / requirements.length;
      const allocated = Math.floor(availableWeeklyMinutes * share);
      const status = determineBudgetStatus(item.requiredMinutes, allocated);
      const warningMessage =
        allocated < item.requiredMinutes
          ? `理想より ${item.requiredMinutes - allocated} 分少なく割り当てています`
          : null;

      return {
        goalId: item.goalId,
        title: item.title,
        requiredMinutes: item.requiredMinutes,
        allocatedMinutes: allocated,
        status,
        warningMessage,
      };
    });
  }

  return {
    periodStart: "",
    periodEnd: "",
    availableWeeklyMinutes,
    totalRequiredMinutes: totalRequired,
    budgets,
    shortageMinutes: Math.max(0, totalRequired - availableWeeklyMinutes),
    suggestions,
  };
}

/**
 * 複数目標の週次予算を一括計算する。
 *
 * @param inputs - 各目標の入力
 * @param availableWeeklyMinutes - 今週の利用可能時間
 * @param period - 週次期間
 */
export function calculateWeeklyBudgets(
  inputs: GoalBudgetCalculationInput[],
  availableWeeklyMinutes: number,
  period: { periodStart: string; periodEnd: string },
): WeeklyBudgetResult {
  const requirements = inputs.map(calculateWeeklyRequired);
  const result = allocateWeeklyBudgets(requirements, availableWeeklyMinutes);

  return {
    ...result,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  };
}
