import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { formatDuration, formatTimeRange } from "@ai-scheduler/core";
import { useFreeTimeForDate } from "@/hooks/useFreeTimeForDate";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { DayOverridePanel } from "@/components/schedule/DayOverridePanel";
import { Loader2 } from "lucide-react";

export function HomePage() {
  const today = new Date();
  const { result: freeTimeResult, isLoading, dateKey } = useFreeTimeForDate(today);

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

  return (
    <div>
      <PageHeader
        title={format(today, "M月d日（EEE）", { locale: ja })}
        description="今日の生活リズムと空き時間を確認できます。変更があれば「今日だけ変更」から調整してください。"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
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

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-notion-text">
              ブロック中の予定
            </h2>
            {freeTimeResult?.blockedBlocks.length === 0 ? (
              <p className="text-sm text-notion-muted">
                固定予定・生活リズムによるブロックはありません。
              </p>
            ) : (
              <ul className="space-y-2">
                {freeTimeResult?.blockedBlocks.map((block, index) => (
                  <li
                    key={`${block.label}-${index}`}
                    className="flex items-center justify-between rounded-[4px] border border-notion-border px-3 py-2"
                  >
                    <span className="text-sm">{block.label}</span>
                    <span className="text-xs text-notion-muted">
                      {formatTimeRange(block.startMinutes, block.endMinutes)}
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
