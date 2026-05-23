import { Navigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@ai-scheduler/core";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { useSetupComplete } from "@/hooks/useScheduleData";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { Loader2 } from "lucide-react";
import { useState } from "react";

type UserPreferencesRow = Tables<"user_preferences">;

export function OnboardingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isComplete, isPending, isFetching } = useSetupComplete();

  const [wakeWeekday, setWakeWeekday] = useState("07:00");
  const [wakeWeekend, setWakeWeekend] = useState("08:00");
  const [sleepWeekday, setSleepWeekday] = useState("23:00");
  const [sleepWeekend, setSleepWeekend] = useState("23:00");
  const [maxSession, setMaxSession] = useState(60);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_preferences")
        .update({
          wake_time_weekday: wakeWeekday,
          wake_time_weekend: wakeWeekend,
          sleep_time_weekday: sleepWeekday,
          sleep_time_weekend: sleepWeekend,
          max_session_minutes: maxSession,
        })
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      if (!user) return;

      queryClient.setQueryData<UserPreferencesRow>(
        queryKeys.userPreferences(user.id),
        (old) => {
          const updated = {
            wake_time_weekday: wakeWeekday,
            wake_time_weekend: wakeWeekend,
            sleep_time_weekday: sleepWeekday,
            sleep_time_weekend: sleepWeekend,
            max_session_minutes: maxSession,
          };

          if (old) {
            return { ...old, ...updated };
          }

          return {
            id: "",
            user_id: user.id,
            focus_times: [],
            break_frequency_minutes: null,
            break_duration_minutes: null,
            notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
            created_at: "",
            updated_at: "",
            ...updated,
          };
        },
      );
    },
  });

  if (isPending || (isFetching && !isComplete)) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  if (isComplete) {
    return <Navigate to="/settings/routines" replace />;
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10">
      <PageHeader
        title="はじめに"
        description="生活リズムの計算に使う、起床・就寝時間を登録してください。この設定は後から変更できます。"
      />

      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>平日の起床時間</Label>
            <Input
              type="time"
              value={wakeWeekday}
              onChange={(e) => setWakeWeekday(e.target.value)}
            />
          </div>
          <div>
            <Label>休日の起床時間</Label>
            <Input
              type="time"
              value={wakeWeekend}
              onChange={(e) => setWakeWeekend(e.target.value)}
            />
          </div>
          <div>
            <Label>平日の就寝時間</Label>
            <Input
              type="time"
              value={sleepWeekday}
              onChange={(e) => setSleepWeekday(e.target.value)}
            />
          </div>
          <div>
            <Label>休日の就寝時間</Label>
            <Input
              type="time"
              value={sleepWeekend}
              onChange={(e) => setSleepWeekend(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
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

        {mutation.error && (
          <p className="mt-4 text-sm text-notion-danger">
            {(mutation.error as Error).message}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "保存中..." : "次へ：生活リズムを登録"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
