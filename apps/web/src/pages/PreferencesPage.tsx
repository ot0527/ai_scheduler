import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FOCUS_TIME_LABELS, userPreferenceFormSchema } from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/hooks/useScheduleData";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";
import { trimTime } from "@/lib/utils";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { useEffect, useState } from "react";

const focusOptions = ["morning", "day", "night", "late_night"] as const;

export function PreferencesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prefsQuery = useUserPreferences();

  const [wakeWeekday, setWakeWeekday] = useState("07:00");
  const [wakeWeekend, setWakeWeekend] = useState("08:00");
  const [sleepWeekday, setSleepWeekday] = useState("23:00");
  const [sleepWeekend, setSleepWeekend] = useState("23:00");
  const [maxSession, setMaxSession] = useState(60);
  const [focusTimes, setFocusTimes] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!prefsQuery.data) return;
    const p = prefsQuery.data;
    setWakeWeekday(trimTime(p.wake_time_weekday) || "07:00");
    setWakeWeekend(trimTime(p.wake_time_weekend) || "08:00");
    setSleepWeekday(trimTime(p.sleep_time_weekday) || "23:00");
    setSleepWeekend(trimTime(p.sleep_time_weekend) || "23:00");
    setMaxSession(p.max_session_minutes);
    setFocusTimes(p.focus_times ?? []);
  }, [prefsQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = userPreferenceFormSchema.parse({
        wakeTimeWeekday: wakeWeekday,
        wakeTimeWeekend: wakeWeekend,
        sleepTimeWeekday: sleepWeekday,
        sleepTimeWeekend: sleepWeekend,
        maxSessionMinutes: maxSession,
        focusTimes,
      });

      const { error } = await supabase
        .from("user_preferences")
        .update({
          wake_time_weekday: parsed.wakeTimeWeekday,
          wake_time_weekend: parsed.wakeTimeWeekend,
          sleep_time_weekday: parsed.sleepTimeWeekday,
          sleep_time_weekend: parsed.sleepTimeWeekend,
          max_session_minutes: parsed.maxSessionMinutes,
          focus_times: parsed.focusTimes,
        })
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage("保存しました");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.userPreferences(user!.id),
      });
    },
  });

  function toggleFocus(value: string) {
    setFocusTimes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  return (
    <div>
      <PageHeader
        title="基本設定"
        description="起床・就寝・集中しやすい時間帯など、スケジュール計算の前提条件を管理します。"
        action={
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "保存中..." : "保存"}
          </Button>
        }
      />

      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>平日の起床</Label>
            <Input
              type="time"
              value={wakeWeekday}
              onChange={(e) => setWakeWeekday(e.target.value)}
            />
          </div>
          <div>
            <Label>休日の起床</Label>
            <Input
              type="time"
              value={wakeWeekend}
              onChange={(e) => setWakeWeekend(e.target.value)}
            />
          </div>
          <div>
            <Label>平日の就寝</Label>
            <Input
              type="time"
              value={sleepWeekday}
              onChange={(e) => setSleepWeekday(e.target.value)}
            />
          </div>
          <div>
            <Label>休日の就寝</Label>
            <Input
              type="time"
              value={sleepWeekend}
              onChange={(e) => setSleepWeekend(e.target.value)}
            />
          </div>
          <div>
            <Label>1回あたりの作業可能時間（分）</Label>
            <Input
              type="number"
              min={15}
              max={480}
              value={maxSession}
              onChange={(e) => setMaxSession(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-6">
          <Label>集中しやすい時間帯</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {focusOptions.map((option) => {
              const active = focusTimes.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleFocus(option)}
                  className={`rounded-[4px] border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-notion-accent bg-blue-50 text-notion-accent"
                      : "border-notion-border bg-white text-notion-muted hover:bg-notion-hover"
                  }`}
                >
                  {FOCUS_TIME_LABELS[option]}
                </button>
              );
            })}
          </div>
        </div>

        {message && (
          <p className="mt-4 text-sm text-notion-success">{message}</p>
        )}
        {mutation.error && (
          <p className="mt-4 text-sm text-notion-danger">
            {(mutation.error as Error).message}
          </p>
        )}
      </Card>
    </div>
  );
}
