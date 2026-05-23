import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ENERGY_LEVEL_LABELS,
  FEASIBILITY_LABELS,
  GOAL_CATEGORY_LABELS,
  GOAL_PHASE_LABELS,
  GOAL_PRIORITY_LABELS,
  GOAL_STATUS_LABELS,
  formatMinutesLabel,
} from "@ai-scheduler/core";
import { useGoal } from "@/hooks/useGoals";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { Loader2, Sparkles } from "lucide-react";

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goalQuery = useGoal(id);

  if (goalQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  if (!goalQuery.data) {
    return (
      <EmptyState
        title="目標が見つかりません"
        action={
          <Button onClick={() => navigate("/goals")}>一覧へ戻る</Button>
        }
      />
    );
  }

  const { goal, components, workBlocks } = goalQuery.data;

  return (
    <div>
      <PageHeader
        title={goal.title}
        description={goal.ai_summary ?? goal.target_condition}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/goals")}>
              一覧へ
            </Button>
            {goal.status === "draft" && (
              <Button onClick={() => navigate(`/goals/${goal.id}/decompose`)}>
                <Sparkles className="h-4 w-4" />
                AI分解
              </Button>
            )}
          </div>
        }
      />

      <Card className="mb-6 p-6">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-notion-muted">ステータス</span>
            <p className="font-medium">
              <Badge tone={goal.status === "active" ? "success" : "warning"}>
                {GOAL_STATUS_LABELS[goal.status]}
              </Badge>
            </p>
          </div>
          <div>
            <span className="text-notion-muted">カテゴリ</span>
            <p className="font-medium">{GOAL_CATEGORY_LABELS[goal.category]}</p>
          </div>
          <div>
            <span className="text-notion-muted">期限</span>
            <p className="font-medium">
              {format(new Date(`${goal.deadline}T00:00:00`), "yyyy年M月d日", {
                locale: ja,
              })}
            </p>
          </div>
          <div>
            <span className="text-notion-muted">優先度</span>
            <p className="font-medium">{GOAL_PRIORITY_LABELS[goal.priority]}</p>
          </div>
          <div>
            <span className="text-notion-muted">週の希望時間</span>
            <p className="font-medium">
              {formatMinutesLabel(goal.weekly_available_minutes)}
            </p>
          </div>
          {goal.estimated_total_minutes && (
            <>
              <div>
                <span className="text-notion-muted">推定必要時間</span>
                <p className="font-medium">
                  {formatMinutesLabel(goal.estimated_total_minutes)}
                </p>
              </div>
              {goal.feasibility && (
                <div>
                  <span className="text-notion-muted">達成可能性</span>
                  <p className="font-medium">
                    {FEASIBILITY_LABELS[goal.feasibility]}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {goal.current_status && (
          <div className="mt-4 border-t border-notion-border pt-4">
            <p className="text-xs text-notion-muted">現在地</p>
            <p className="mt-1 text-sm">{goal.current_status}</p>
          </div>
        )}
      </Card>

      {components.length === 0 ? (
        <EmptyState
          title="まだ分解されていません"
          description="AI 分解を実行し、構成要素と作業ブロックを作成してください。"
          action={
            <Button onClick={() => navigate(`/goals/${goal.id}/decompose`)}>
              AI分解を開始
            </Button>
          }
        />
      ) : (
        <>
          <h2 className="mb-3 text-lg font-semibold">構成要素</h2>
          <div className="mb-8 space-y-2">
            {components.map((component) => (
              <Card key={component.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{component.name}</p>
                    <p className="text-sm text-notion-muted">
                      {formatMinutesLabel(component.estimated_minutes)}
                      {" · "}
                      {GOAL_PHASE_LABELS[component.phase]}
                      {" · "}
                      優先度 {GOAL_PRIORITY_LABELS[component.priority]}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <h2 className="mb-3 text-lg font-semibold">作業ブロック</h2>
          <div className="space-y-2">
            {workBlocks.map((block) => {
              const component = components.find(
                (item) => item.id === block.component_id,
              );
              return (
                <Card key={block.id} className="p-4">
                  <p className="font-medium">{block.title}</p>
                  <p className="text-sm text-notion-muted">
                    {component?.name ?? "—"}
                    {" · "}
                    {block.min_minutes}–{block.max_minutes}分（理想{" "}
                    {block.ideal_minutes}分）
                    {" · "}
                    集中力 {ENERGY_LEVEL_LABELS[block.energy]}
                  </p>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-8 text-sm text-notion-muted">
        AI 設定は{" "}
        <Link to="/settings/ai" className="text-notion-accent hover:underline">
          設定 → AI
        </Link>{" "}
        から行えます。
      </p>
    </div>
  );
}
