import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GoalBudgetRow, WeeklyBudgetResult } from "@ai-scheduler/core";
import { getWeekPeriod } from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { invokeFunction } from "@/lib/edge-functions";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";

export interface GoalBudgetWithTitle extends GoalBudgetRow {
  goalTitle: string;
}

/** ローカル日付を yyyy-MM-dd に変換する。 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 今週の時間予算一覧を取得する。 */
export function useGoalBudgets(referenceDate = new Date()) {
  const { user } = useAuth();
  const period = getWeekPeriod(referenceDate);

  return useQuery({
    queryKey: queryKeys.goalBudgets(user?.id ?? "", period.periodStart),
    enabled: !!user,
    queryFn: async () => {
      const { data: budgets, error } = await supabase
        .from("goal_budgets")
        .select("*")
        .eq("user_id", user!.id)
        .eq("period_start", period.periodStart)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!budgets?.length) {
        return { period, budgets: [] as GoalBudgetWithTitle[] };
      }

      const goalIds = budgets.map((budget) => budget.goal_id);
      const { data: goals, error: goalsError } = await supabase
        .from("goals")
        .select("id, title")
        .in("id", goalIds);

      if (goalsError) throw goalsError;

      const titleByGoalId = new Map(
        (goals ?? []).map((goal) => [goal.id, goal.title]),
      );

      const enriched: GoalBudgetWithTitle[] = budgets.map((budget) => ({
        ...budget,
        goalTitle: titleByGoalId.get(budget.goal_id) ?? "目標",
      }));

      return { period, budgets: enriched };
    },
  });
}

/** 未読アラートを取得する。 */
export function useAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.alerts(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

/** 週次時間予算を Edge Function で再計算する。 */
export function useCalculateBudgets() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (referenceDate?: string) => {
      return invokeFunction<WeeklyBudgetResult & { period: { periodStart: string; periodEnd: string } }>(
        "budget-calculate",
        { body: { referenceDate } },
      );
    },
    onSuccess: async () => {
      if (!user) return;
      await queryClient.invalidateQueries({
        queryKey: ["goal_budgets", user.id],
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.alerts(user.id),
      });
    },
  });
}
