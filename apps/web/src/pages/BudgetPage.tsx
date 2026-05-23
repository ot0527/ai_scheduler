import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  GOAL_BUDGET_STATUS_LABELS,
  formatDuration,
  formatMinutesLabel,
} from "@ai-scheduler/core";
import {
  useAlerts,
  useCalculateBudgets,
  useGoalBudgets,
} from "@/hooks/useBudgets";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { AlertCircle, Calculator, Loader2 } from "lucide-react";
import { useState } from "react";

function budgetTone(
  status: keyof typeof GOAL_BUDGET_STATUS_LABELS,
): "success" | "warning" | "info" | "neutral" {
  if (status === "on_track") return "success";
  if (status === "behind") return "warning";
  if (status === "at_risk") return "info";
  return "neutral";
}

export function BudgetPage() {
  const today = new Date();
  const budgetsQuery = useGoalBudgets(today);
  const alertsQuery = useAlerts();
  const calculateMutation = useCalculateBudgets();
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    setError(null);
    try {
      await calculateMutation.mutateAsync(undefined);
      await budgetsQuery.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "計算に失敗しました");
    }
  };

  const periodLabel =
    budgetsQuery.data?.period != null
      ? `${format(new Date(budgetsQuery.data.period.periodStart + "T12:00:00"), "M/d", { locale: ja })} 〜 ${format(new Date(budgetsQuery.data.period.periodEnd + "T12:00:00"), "M/d", { locale: ja })}`
      : "";

  return (
    <div>
      <PageHeader
        title="今週の時間予算"
        description="アクティブな目標ごとに、期限と残り作業量から週あたりの必要時間を計算し、今週の自由時間に按分します。"
        action={
          <Button
            onClick={handleCalculate}
            disabled={calculateMutation.isPending}
          >
            {calculateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4" />
            )}
            予算を再計算
          </Button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-[4px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {alertsQuery.data && alertsQuery.data.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-amber-900">注意</h2>
          <ul className="space-y-3">
            {alertsQuery.data.map((alert) => (
              <li key={alert.id} className="text-sm text-amber-900">
                <p>{alert.message}</p>
                {Array.isArray(alert.suggestions) && alert.suggestions.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
                    {(alert.suggestions as string[]).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {budgetsQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
        </div>
      ) : !budgetsQuery.data?.budgets.length ? (
        <EmptyState
          title="時間予算が未計算です"
          description="アクティブな目標がある場合、「予算を再計算」で今週の割当を作成できます。"
          action={
            <Button onClick={handleCalculate} disabled={calculateMutation.isPending}>
              予算を計算する
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-notion-muted">対象週: {periodLabel}</p>

          {budgetsQuery.data.budgets.map((budget) => (
              <Card key={budget.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-notion-text">
                      {budget.goalTitle}
                    </h3>
                    <p className="mt-1 text-xs text-notion-muted">
                      必要 {formatMinutesLabel(budget.required_minutes)} / 割当{" "}
                      {formatMinutesLabel(budget.allocated_minutes)}
                    </p>
                    {budget.warning_message && (
                      <p className="mt-2 text-xs text-amber-700">
                        {budget.warning_message}
                      </p>
                    )}
                  </div>
                  <Badge tone={budgetTone(budget.status)}>
                    {GOAL_BUDGET_STATUS_LABELS[budget.status]}
                  </Badge>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-notion-hover">
                  <div
                    className="h-full rounded-full bg-notion-accent transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        budget.required_minutes > 0
                          ? (budget.allocated_minutes / budget.required_minutes) * 100
                          : 100,
                      )}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-notion-muted">
                  今週の消化: {formatDuration(budget.completed_minutes)}
                </p>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
