import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  SCHEDULE_STATUS_LABELS,
  formatMinutesLabel,
  parseDateKey,
} from "@ai-scheduler/core";
import { useCancelSchedule } from "@/hooks/useExecution";
import {
  formatDbTime,
  useApproveSchedule,
  useGenerateSchedule,
  useScheduleForDate,
} from "@/hooks/useSchedules";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { AlertCircle, Check, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";

export function ScheduleApprovePage() {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const targetDate = dateParam ? parseDateKey(dateParam) : new Date();
  const navigate = useNavigate();
  const scheduleQuery = useScheduleForDate(targetDate);
  const generateMutation = useGenerateSchedule();
  const approveMutation = useApproveSchedule();
  const cancelMutation = useCancelSchedule();
  const [error, setError] = useState<string | null>(null);

  const dateKey =
    dateParam ??
    `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

  const handleGenerate = async () => {
    setError(null);
    try {
      await generateMutation.mutateAsync(dateKey);
      await scheduleQuery.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    }
  };

  const handleApprove = async () => {
    const scheduleId = scheduleQuery.data?.schedule.id;
    if (!scheduleId) return;
    setError(null);
    try {
      await approveMutation.mutateAsync(scheduleId);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    }
  };

  const handleCancel = async () => {
    const schedule = scheduleQuery.data?.schedule;
    if (!schedule) return;
    if (!window.confirm("承認済みの予定をキャンセルしますか？")) return;
    setError(null);
    try {
      await cancelMutation.mutateAsync({
        scheduleId: schedule.id,
        targetDate: schedule.target_date,
      });
      await scheduleQuery.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "キャンセルに失敗しました");
    }
  };

  const schedule = scheduleQuery.data;
  const isDraft = schedule?.schedule.status === "draft";
  const isApproved =
    schedule?.schedule.status === "approved" ||
    schedule?.schedule.status === "in_progress";
  const isToday =
    dateKey ===
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

  return (
    <div>
      <PageHeader
        title={isToday ? "今日の仮スケジュール" : "仮スケジュール"}
        description={format(targetDate, "M月d日（EEE）", { locale: ja })}
        action={
          <div className="flex gap-2">
            {isApproved && (
              <Button
                variant="danger"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                キャンセル
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleGenerate}
              disabled={generateMutation.isPending || isApproved}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              再提案
            </Button>
            {isDraft && schedule.blocks.length > 0 && (
              <Button onClick={handleApprove} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                予定に反映
              </Button>
            )}
          </div>
        }
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
      ) : !schedule ? (
        <EmptyState
          title="予定が未生成です"
          description="空き時間と時間予算をもとに、作業ブロックを仮配置します。"
          action={
            <div className="flex flex-col items-center gap-2">
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                予定を生成
              </Button>
              <Link to="/budget" className="text-xs text-notion-accent hover:underline">
                先に時間予算を計算する
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge tone={isApproved ? "success" : "info"}>
              {SCHEDULE_STATUS_LABELS[schedule.schedule.status]}
            </Badge>
            {schedule.schedule.summary && (
              <span className="text-sm text-notion-muted">
                {schedule.schedule.summary}
              </span>
            )}
          </div>

          {schedule.blocks.length === 0 ? (
            <EmptyState
              title="配置できる作業がありませんでした"
              description="空き時間が不足しているか、作業ブロックの条件に合う枠がありません。"
              action={
                <Button variant="secondary" onClick={handleGenerate}>
                  再提案
                </Button>
              }
            />
          ) : (
            <Card className="divide-y divide-notion-border">
              {schedule.blocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-notion-text">
                      {block.title}
                    </p>
                    <p className="mt-0.5 text-xs text-notion-muted">
                      {formatDbTime(block.start_time)} – {formatDbTime(block.end_time)}
                    </p>
                  </div>
                  <Badge tone="neutral">
                    {formatMinutesLabel(block.planned_minutes)}
                  </Badge>
                </div>
              ))}
            </Card>
          )}

          {isApproved && (
            <p className="text-sm text-notion-muted">
              承認済みの予定です。再提案する場合は先にキャンセルしてください。
              <Link to="/" className="ml-1 text-notion-accent hover:underline">
                ホームで確認
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
