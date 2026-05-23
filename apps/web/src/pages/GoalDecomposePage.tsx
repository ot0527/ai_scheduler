import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { GoalDecomposeOutput } from "@ai-scheduler/core";
import {
  ENERGY_LEVEL_LABELS,
  FEASIBILITY_LABELS,
  GOAL_PHASE_LABELS,
  GOAL_PRIORITY_LABELS,
  formatMinutesLabel,
} from "@ai-scheduler/core";
import {
  useApproveDecompose,
  useGoal,
  useGoalDecompose,
} from "@/hooks/useGoals";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { AlertCircle, Check, Loader2, Sparkles } from "lucide-react";

export function GoalDecomposePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goalQuery = useGoal(id);
  const decomposeMutation = useGoalDecompose();
  const approveMutation = useApproveDecompose();

  const [preview, setPreview] = useState<GoalDecomposeOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goalQuery.data?.goal.status === "active") {
      navigate(`/goals/${id}`, { replace: true });
    }
  }, [goalQuery.data, id, navigate]);

  const runDecompose = async () => {
    if (!id) return;
    setError(null);
    try {
      const result = await decomposeMutation.mutateAsync(id);
      setPreview(result.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 分解に失敗しました");
    }
  };

  const handleApprove = async () => {
    if (!id || !preview) return;
    setError(null);
    try {
      await approveMutation.mutateAsync({ goalId: id, decompose: preview });
      navigate(`/goals/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    }
  };

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
        action={<Button onClick={() => navigate("/goals")}>一覧へ</Button>}
      />
    );
  }

  const { goal } = goalQuery.data;

  return (
    <div>
      <PageHeader
        title="AI 分解結果"
        description={`「${goal.title}」を構成要素と作業ブロックに分解します。内容を確認してから承認してください。`}
        action={
          <Button variant="secondary" onClick={() => navigate(`/goals/${id}`)}>
            詳細へ
          </Button>
        }
      />

      {!preview && (
        <Card className="mb-6 p-6 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-notion-accent" />
          <p className="mb-4 text-sm text-notion-muted">
            AI が目標を分析し、推定時間・構成要素・作業ブロックを提案します。
            API キーは{" "}
            <Link to="/settings/ai" className="text-notion-accent hover:underline">
              AI 設定
            </Link>{" "}
            で登録してください。
          </p>
          <Button onClick={runDecompose} disabled={decomposeMutation.isPending}>
            {decomposeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AIで分解する
          </Button>
        </Card>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-[6px] border border-red-200 bg-red-50 p-4 text-sm text-notion-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <>
          <Card className="mb-6 p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">概要</h2>
              <Badge tone="info">
                {FEASIBILITY_LABELS[preview.goal.feasibility]}
              </Badge>
            </div>
            <p className="text-2xl font-bold text-notion-text">
              推定必要時間: {formatMinutesLabel(preview.goal.estimatedTotalMinutes)}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-notion-muted">
              {preview.goal.summary}
            </p>
          </Card>

          <h3 className="mb-3 font-semibold">構成要素</h3>
          <div className="mb-6 space-y-2">
            {preview.components.map((component, index) => (
              <Card key={`${component.name}-${index}`} className="p-4">
                <p className="font-medium">{component.name}</p>
                <p className="text-sm text-notion-muted">
                  {formatMinutesLabel(component.estimatedMinutes)}
                  {" · "}
                  {GOAL_PHASE_LABELS[component.phase]}
                  {" · "}
                  優先度 {GOAL_PRIORITY_LABELS[component.priority]}
                  {component.recommendedSessionsPerWeek != null &&
                    ` · 週${component.recommendedSessionsPerWeek}回`}
                </p>
              </Card>
            ))}
          </div>

          <h3 className="mb-3 font-semibold">作業ブロック</h3>
          <div className="mb-6 space-y-2">
            {preview.workBlocks.map((block, index) => (
              <Card key={`${block.title}-${index}`} className="p-4">
                <p className="font-medium">{block.title}</p>
                <p className="text-sm text-notion-muted">
                  {block.component}
                  {" · "}
                  {block.minMinutes}–{block.maxMinutes}分（理想 {block.idealMinutes}分）
                  {" · "}
                  集中力 {ENERGY_LEVEL_LABELS[block.energy]}
                  {block.requiresDeepWork && " · 深い集中が必要"}
                </p>
              </Card>
            ))}
          </div>

          {preview.questions.length > 0 && (
            <Card className="mb-6 border-amber-200 bg-amber-50/50 p-4">
              <p className="mb-2 text-sm font-medium text-amber-800">
                AI からの確認事項
              </p>
              <ul className="list-inside list-disc text-sm text-amber-900">
                {preview.questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              この内容で作成
            </Button>
            <Button
              variant="secondary"
              onClick={runDecompose}
              disabled={decomposeMutation.isPending}
            >
              再生成
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              修正する（やり直し）
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
