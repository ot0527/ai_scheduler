import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DAY_LABELS,
  fixedScheduleFormSchema,
  formatDaysOfWeek,
} from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { useFixedSchedules } from "@/hooks/useScheduleData";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";
import { trimTime } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
} from "@/components/ui";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

export function FixedSchedulesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const schedulesQuery = useFixedSchedules();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [commuteMinutes, setCommuteMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const parsed = fixedScheduleFormSchema.parse({
        title,
        startTime,
        endTime,
        daysOfWeek,
        commuteMinutes,
      });

      const { error: insertError } = await supabase
        .from("fixed_schedules")
        .insert({
          user_id: user!.id,
          title: parsed.title,
          start_time: parsed.startTime,
          end_time: parsed.endTime,
          days_of_week: parsed.daysOfWeek,
          commute_minutes: parsed.commuteMinutes,
        });

      if (insertError) throw insertError;
    },
    onSuccess: async () => {
      setShowForm(false);
      setTitle("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fixedSchedules(user!.id),
      });
    },
    onError: (err) => setError((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fixed_schedules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fixedSchedules(user!.id),
      });
    },
  });

  if (schedulesQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="固定予定"
        description="仕事・学校・バイトなど、原則動かせない予定を登録します。空き時間計算時に必ず除外されます。"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-sm font-semibold">固定予定を追加</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>タイトル</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 仕事"
              />
            </div>
            <div>
              <Label>開始</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>終了</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div>
              <Label>移動時間（分）</Label>
              <Input
                type="number"
                min={0}
                max={180}
                value={commuteMinutes}
                onChange={(e) => setCommuteMinutes(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>曜日</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAY_LABELS.map((label, index) => {
                  const active = daysOfWeek.includes(index);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(index)}
                      className={`h-9 w-9 rounded-[4px] border text-sm transition-colors ${
                        active
                          ? "border-notion-accent bg-blue-50 text-notion-accent"
                          : "border-notion-border bg-white text-notion-muted hover:bg-notion-hover"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-notion-danger">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !title || daysOfWeek.length === 0}
            >
              保存
            </Button>
          </div>
        </Card>
      )}

      {(schedulesQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="固定予定がまだありません"
          description="仕事 9:00–18:00（月–金）などを登録しましょう。"
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              最初の固定予定を追加
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {schedulesQuery.data?.map((schedule) => (
            <Card
              key={schedule.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-notion-text">
                    {schedule.title}
                  </p>
                  <Badge tone="neutral">
                    {formatDaysOfWeek(schedule.days_of_week)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-notion-muted">
                  {trimTime(schedule.start_time)} –{" "}
                  {trimTime(schedule.end_time)}
                  {schedule.commute_minutes > 0 &&
                    ` · 移動 ${schedule.commute_minutes}分`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(schedule.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
