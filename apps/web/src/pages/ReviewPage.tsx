import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  FATIGUE_LEVEL_LABELS,
  SCHEDULED_BLOCK_STATUS_LABELS,
  formatDuration,
  type FatigueLevel,
  type MajorRescheduleOutput,
} from "@ai-scheduler/core";
import {
  formatDbTime,
  useScheduleForDate,
} from "@/hooks/useSchedules";
import { useGoals } from "@/hooks/useGoals";
import {
  todayDateKey,
  useApplyMajorReschedule,
  useMajorReschedulePreview,
  useMinorReschedule,
  useRecordBlockCompletion,
  useSubmitDailyReview,
  type RecordBlockInput,
} from "@/hooks/useExecution";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
} from "@/components/ui";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

export function ReviewPage() {
  const today = new Date();
  const dateKey = todayDateKey();
  const scheduleQuery = useScheduleForDate(today);
  const goalsQuery = useGoals();
  const recordMutation = useRecordBlockCompletion();
  const reviewMutation = useSubmitDailyReview();
  const minorRescheduleMutation = useMinorReschedule();
  const majorPreviewMutation = useMajorReschedulePreview();
  const applyMajorMutation = useApplyMajorReschedule();

  const [error, setError] = useState<string | null>(null);
  const [partialMinutes, setPartialMinutes] = useState<Record<string, string>>({});
  const [fatigueLevel, setFatigueLevel] = useState<FatigueLevel>(3);
  const [reviewNote, setReviewNote] = useState("");
  const [majorPreview, setMajorPreview] = useState<MajorRescheduleOutput | null>(
    null,
  );

  const schedule = scheduleQuery.data;
  const blocks = schedule?.blocks ?? [];
  const canRecord =
    schedule &&
    (schedule.schedule.status === "approved" ||
      schedule.schedule.status === "in_progress" ||
      schedule.schedule.status === "completed");

  const incompleteBlocks = blocks.filter(
    (block) =>
      block.status === "skipped" ||
      (block.status === "partial" &&
        block.actual_minutes < block.planned_minutes) ||
      block.status === "planned",
  );

  const handleRecord = async (
    block: (typeof blocks)[number],
    status: RecordBlockInput["status"],
  ) => {
    if (!schedule) return;
    setError(null);

    const actualMinutes =
      status === "partial"
        ? Number(partialMinutes[block.id] ?? block.planned_minutes)
        : undefined;

    if (status === "partial" && (Number.isNaN(actualMinutes) || actualMinutes! <= 0)) {
      setError("一部達成の場合は実績分数を入力してください");
      return;
    }

    try {
      await recordMutation.mutateAsync({
        blockId: block.id,
        scheduleId: schedule.schedule.id,
        goalId: block.goal_id,
        plannedMinutes: block.planned_minutes,
        previousActualMinutes: block.actual_minutes,
        status,
        actualMinutes,
        targetDate: schedule.schedule.target_date,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "記録に失敗しました");
    }
  };

  const handleSubmitReview = async () => {
    if (!schedule) return;
    setError(null);
    try {
      await reviewMutation.mutateAsync({
        scheduleId: schedule.schedule.id,
        targetDate: schedule.schedule.target_date,
        fatigueLevel,
        reviewNote,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "振り返りの保存に失敗しました");
    }
  };

  const handleMinorReschedule = async () => {
    setError(null);
    try {
      const result = await minorRescheduleMutation.mutateAsync(dateKey);
      if (result.proposals.length > 0) {
        const first = result.proposals[0]!;
        window.location.href = `/schedule/approve?date=${first.targetDate}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "再配置に失敗しました");
    }
  };

  const handleMajorPreview = async () => {
    setError(null);
    setMajorPreview(null);
    try {
      const result = await majorPreviewMutation.mutateAsync();
      setMajorPreview(result.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 再計画に失敗しました");
    }
  };

  const handleApplyMajor = async () => {
    if (!majorPreview) return;
    setError(null);
    try {
      await applyMajorMutation.mutateAsync(majorPreview);
      setMajorPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    }
  };

  return (
    <div>
      <PageHeader
        title="進捗・振り返り"
        description={format(today, "M月d日（EEE）", { locale: ja })}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-[4px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {scheduleQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
        </div>
      ) : !canRecord ? (
        <EmptyState
          title="今日の作業予定がありません"
          description="先に今日の予定を生成・承認してください。"
          action={
            <Link to="/schedule/approve">
              <Button>予定を生成する</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          <Card className="divide-y divide-notion-border">
            {blocks.map((block) => (
              <div key={block.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-notion-text">
                      {block.title}
                    </p>
                    <p className="mt-0.5 text-xs text-notion-muted">
                      {formatDbTime(block.start_time)} –{" "}
                      {formatDbTime(block.end_time)} ·{" "}
                      {formatDuration(block.planned_minutes)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      block.status === "done"
                        ? "success"
                        : block.status === "skipped"
                          ? "warning"
                          : block.status === "partial"
                            ? "info"
                            : "neutral"
                    }
                  >
                    {SCHEDULED_BLOCK_STATUS_LABELS[block.status]}
                  </Badge>
                </div>

                {block.status === "planned" && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRecord(block, "done")}
                      disabled={recordMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5" />
                      完了
                    </Button>
                    <div className="flex items-end gap-2">
                      <div>
                        <Label>実績（分）</Label>
                        <Input
                          type="number"
                          min={1}
                          max={block.planned_minutes}
                          className="w-20"
                          value={partialMinutes[block.id] ?? ""}
                          onChange={(event) =>
                            setPartialMinutes((prev) => ({
                              ...prev,
                              [block.id]: event.target.value,
                            }))
                          }
                          placeholder={String(block.planned_minutes)}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRecord(block, "partial")}
                        disabled={recordMutation.isPending}
                      >
                        一部達成
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRecord(block, "skipped")}
                      disabled={recordMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                      未達成
                    </Button>
                  </div>
                )}

                {block.status !== "planned" && block.actual_minutes > 0 && (
                  <p className="mt-2 text-xs text-notion-muted">
                    実績: {formatDuration(block.actual_minutes)}
                  </p>
                )}
              </div>
            ))}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-notion-text">
              今日の振り返り
            </h2>
            <div className="space-y-4">
              <div>
                <Label>疲労度</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {([1, 2, 3, 4, 5] as FatigueLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFatigueLevel(level)}
                      className={`rounded-[4px] border px-3 py-1.5 text-xs transition-colors ${
                        fatigueLevel === level
                          ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
                          : "border-notion-border text-notion-muted hover:bg-notion-hover"
                      }`}
                    >
                      {FATIGUE_LEVEL_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>メモ（任意）</Label>
                <textarea
                  className="mt-1.5 w-full rounded-[4px] border border-notion-border px-3 py-2 text-sm outline-none focus:border-notion-accent focus:ring-2 focus:ring-notion-accent/20"
                  rows={3}
                  maxLength={1000}
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="今日の気づきや体調など"
                />
              </div>
              <Button
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                振り返りを保存
              </Button>
              {schedule.schedule.reviewed_at && (
                <p className="text-xs text-notion-muted">
                  保存済み（疲労度:{" "}
                  {schedule.schedule.fatigue_level
                    ? FATIGUE_LEVEL_LABELS[
                        schedule.schedule.fatigue_level as FatigueLevel
                      ]
                    : "未設定"}
                  ）
                </p>
              )}
            </div>
          </Card>

          {incompleteBlocks.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-notion-text">
                リスケジュール
              </h2>
              <p className="mt-1 text-sm text-notion-muted">
                未完了の作業を翌日以降の空き時間へ再配置します（AI 不使用）。
              </p>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={handleMinorReschedule}
                disabled={minorRescheduleMutation.isPending}
              >
                {minorRescheduleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                未完了を再配置する
              </Button>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-notion-text">
              大規模リスケ（AI）
            </h2>
            <p className="mt-1 text-sm text-notion-muted">
              進捗が大きく遅れている場合、AI が週次時間配分の見直し案を提案します。
            </p>
            <Button
              className="mt-4"
              onClick={handleMajorPreview}
              disabled={majorPreviewMutation.isPending}
            >
              {majorPreviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI に再計画を依頼
            </Button>

            {majorPreview && (
              <div className="mt-4 rounded-[4px] border border-notion-border bg-notion-sidebar/50 p-4">
                <p className="text-sm text-notion-text">{majorPreview.summary}</p>
                {majorPreview.updatedBudgets.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-notion-muted">
                    {majorPreview.updatedBudgets.map((budget) => {
                      const goal = goalsQuery.data?.find((item) => item.id === budget.goalId);
                      return (
                        <li key={budget.goalId}>
                          {goal?.title ?? budget.goalId.slice(0, 8)} → 週{" "}
                          {Math.round(budget.weeklyTargetMinutes / 60)}時間
                        </li>
                      );
                    })}
                  </ul>
                )}
                {majorPreview.recommendations.length > 0 && (
                  <ul className="mt-3 list-disc pl-4 text-xs text-notion-muted">
                    {majorPreview.recommendations.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleApplyMajor}
                    disabled={applyMajorMutation.isPending}
                  >
                    この案を反映
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setMajorPreview(null)}
                  >
                    却下
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <div className="text-center">
            <Link
              to="/budget"
              className="inline-flex items-center gap-1 text-sm text-notion-accent hover:underline"
            >
              時間予算を確認
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
