import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import {
  GOAL_CATEGORY_LABELS,
  GOAL_PRIORITY_LABELS,
  GOAL_STATUS_LABELS,
  formatMinutesLabel,
} from "@ai-scheduler/core";
import { useGoals } from "@/hooks/useGoals";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { Loader2, Plus, Target, Trash2 } from "lucide-react";

function statusTone(status: string): "neutral" | "success" | "warning" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "draft":
      return "warning";
    case "completed":
      return "info";
    default:
      return "neutral";
  }
}

export function GoalsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const goalsQuery = useGoals();

  const deleteMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goals(user!.id),
      });
    },
  });

  if (goalsQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  const goals = goalsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="目標"
        description="長期目標を登録し、AI で構成要素と作業ブロックに分解します。承認後に計画へ反映されます。"
        action={
          <Button onClick={() => navigate("/goals/new")}>
            <Plus className="h-4 w-4" />
            目標を追加
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          title="まだ目標がありません"
          description="資格取得、創作、運動など、達成したい長期目標を登録しましょう。"
          action={
            <Button onClick={() => navigate("/goals/new")}>
              <Target className="h-4 w-4" />
              最初の目標を作成
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <Card key={goal.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Link
                      to={`/goals/${goal.id}`}
                      className="text-base font-semibold text-notion-text hover:text-notion-accent"
                    >
                      {goal.title}
                    </Link>
                    <Badge tone={statusTone(goal.status)}>
                      {GOAL_STATUS_LABELS[goal.status]}
                    </Badge>
                    <Badge tone="neutral">
                      {GOAL_CATEGORY_LABELS[goal.category]}
                    </Badge>
                  </div>
                  <p className="text-sm text-notion-muted">
                    期限:{" "}
                    {format(new Date(`${goal.deadline}T00:00:00`), "yyyy/M/d", {
                      locale: ja,
                    })}
                    {" · "}
                    優先度: {GOAL_PRIORITY_LABELS[goal.priority]}
                    {" · "}
                    週{formatMinutesLabel(goal.weekly_available_minutes)}
                  </p>
                  {goal.estimated_total_minutes && (
                    <p className="mt-1 text-sm text-notion-muted">
                      推定必要時間: {formatMinutesLabel(goal.estimated_total_minutes)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  {goal.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/goals/${goal.id}/decompose`)}
                    >
                      AI分解
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("この目標を削除しますか？")) {
                        deleteMutation.mutate(goal.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
