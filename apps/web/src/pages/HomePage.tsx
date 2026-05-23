import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  SCHEDULED_BLOCK_STATUS_LABELS,
  formatDuration,
  formatTimeRange,
  maskAlertMessage,
} from "@ai-scheduler/core";
import { useFreeTimeForDate } from "@/hooks/useFreeTimeForDate";
import { useAlerts } from "@/hooks/useBudgets";
import { useNotificationSettings } from "@/hooks/usePhase5";
import {
  formatDbTime,
  useScheduleForDate,
} from "@/hooks/useSchedules";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { DayOverridePanel } from "@/components/schedule/DayOverridePanel";
import { CalendarCheck, ClipboardCheck, Loader2, PieChart, Sparkles } from "lucide-react";

export function HomePage() {
  const today = new Date();
  const { result: freeTimeResult, isLoading, dateKey } = useFreeTimeForDate(today);
  const scheduleQuery = useScheduleForDate(today);
  const alertsQuery = useAlerts();
  const notificationQuery = useNotificationSettings();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  const totalFreeMinutes =
    freeTimeResult?.freeSlots.reduce((sum, s) => sum + s.durationMinutes, 0) ??
    0;

  const schedule = scheduleQuery.data;
  const workBlocks =
    schedule &&
    ["approved", "in_progress", "completed"].includes(schedule.schedule.status)
      ? schedule.blocks
      : [];

  return (
    <div>
      <PageHeader
        title={format(today, "M月d日（EEE）", { locale: ja })}
        description="今日の生活リズム・空き時間・作業予定を確認できます。"
        action={
          <div className="flex gap-2">
            <Link to="/budget">
              <Button variant="secondary">
                <PieChart className="h-4 w-4" />
                時間予算
              </Button>
            </Link>
            <Link to="/review">
              <Button variant="secondary">
                <ClipboardCheck className="h-4 w-4" />
                振り返り
              </Button>
            </Link>
            <Link to="/schedule/approve">
              <Button>
                <Sparkles className="h-4 w-4" />
                {schedule?.schedule.status === "draft"
                  ? "仮予定を確認"
                  : "予定を生成"}
              </Button>
            </Link>
          </div>
        }
      />

      {alertsQuery.data && alertsQuery.data.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {maskAlertMessage(
              alertsQuery.data[0]?.message ?? "",
              notificationQuery.data?.showDetailedAlerts ?? false,
            )}
          </p>
          <Link
            to="/budget"
            className="mt-2 inline-block text-xs text-amber-800 hover:underline"
          >
            時間予算の詳細を見る
          </Link>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-notion-text">
                今日の作業予定
              </h2>
              {schedule && (
                <Badge tone={schedule.schedule.status === "approved" ? "success" : "info"}>
                  {schedule.schedule.status === "approved" ? "承認済み" : "下書き"}
                </Badge>
              )}
            </div>

            {scheduleQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-notion-muted" />
              </div>
            ) : workBlocks.length > 0 ? (
              <ul className="divide-y divide-notion-border">
                {workBlocks.map((block) => (
                  <li
                    key={block.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-notion-text">
                        {block.title}
                      </p>
                      <p className="mt-0.5 text-xs text-notion-muted">
                        {formatDbTime(block.start_time)} –{" "}
                        {formatDbTime(block.end_time)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone="neutral">
                        {formatDuration(block.planned_minutes)}
                      </Badge>
                      {block.status !== "planned" && (
                        <Badge
                          tone={
                            block.status === "done"
                              ? "success"
                              : block.status === "skipped"
                                ? "warning"
                                : "info"
                          }
                        >
                          {SCHEDULED_BLOCK_STATUS_LABELS[block.status]}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : schedule?.schedule.status === "draft" && schedule.blocks.length > 0 ? (
              <EmptyState
                title="仮スケジュールがあります"
                description="内容を確認して「今日の予定に反映」してください。"
                action={
                  <Link to="/schedule/approve">
                    <Button size="sm">
                      <CalendarCheck className="h-4 w-4" />
                      承認画面へ
                    </Button>
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title="今日の作業予定がありません"
                description="時間予算を計算したうえで、今日の予定を生成できます。"
                action={
                  <Link to="/schedule/approve">
                    <Button size="sm">予定を生成する</Button>
                  </Link>
                }
              />
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-notion-text">
                今日の生活予定
              </h2>
              <Badge tone="neutral">
                起床 {freeTimeResult?.wakeTime} / 就寝{" "}
                {freeTimeResult?.sleepTime}
              </Badge>
            </div>

            {freeTimeResult?.lifeRoutines.length === 0 ? (
              <EmptyState
                title="生活リズムが未登録です"
                description="食事・風呂などを登録すると、ここに表示されます。"
              />
            ) : (
              <ul className="divide-y divide-notion-border">
                {freeTimeResult?.lifeRoutines.map((routine) => (
                  <li
                    key={routine.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-notion-text">
                        {routine.label}
                      </p>
                      <p className="mt-0.5 text-xs text-notion-muted">
                        {routine.preferredTime}ごろ · {routine.durationMinutes}
                        分
                      </p>
                    </div>
                    {routine.skipped ? (
                      <Badge tone="warning">今日はスキップ</Badge>
                    ) : (
                      <Badge tone="success">予定あり</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-notion-text">
                今日の空き時間
              </h2>
              <Badge tone="success">
                合計 {formatDuration(totalFreeMinutes)}
              </Badge>
            </div>

            {freeTimeResult?.freeSlots.length === 0 ? (
              <EmptyState title="空き時間がありません" />
            ) : (
              <ul className="space-y-2">
                {freeTimeResult?.freeSlots.map((slot, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-[4px] bg-notion-sidebar/70 px-3 py-2.5"
                  >
                    <span className="text-sm text-notion-text">
                      {formatTimeRange(slot.startMinutes, slot.endMinutes)}
                    </span>
                    <span className="text-xs text-notion-muted">
                      {formatDuration(slot.durationMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <DayOverridePanel date={dateKey} freeTimeResult={freeTimeResult} />
      </div>
    </div>
  );
}
