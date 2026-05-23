import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FreeTimeResult } from "@ai-scheduler/core";
import { buildOverridePayload } from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { useDayOverrides, useLifeRoutines } from "@/hooks/useScheduleData";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";
import { trimTime } from "@/lib/utils";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { useState } from "react";

export function DayOverridePanel({
  date,
  freeTimeResult,
}: {
  date: string;
  freeTimeResult: FreeTimeResult | null;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const routinesQuery = useLifeRoutines();
  const overridesQuery = useDayOverrides(date);

  const [targetType, setTargetType] = useState<"wake" | "sleep" | "routine">(
    "routine",
  );
  const [routineId, setRoutineId] = useState("");
  const [action, setAction] = useState<"modify" | "skip">("modify");
  const [preferredTime, setPreferredTime] = useState("21:00");
  const [durationMinutes, setDurationMinutes] = useState(30);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload =
        targetType === "routine"
          ? buildOverridePayload(
              {
                targetType: "routine",
                lifeRoutineId: routineId,
                action,
                preferredTime: action === "modify" ? preferredTime : undefined,
                durationMinutes:
                  action === "modify" ? durationMinutes : undefined,
                flexibilityMinutes: 30,
              },
              date,
            )
          : buildOverridePayload(
              {
                targetType,
                action,
                preferredTime: action === "modify" ? preferredTime : undefined,
              },
              date,
            );

      const { error } = await supabase.from("routine_day_overrides").upsert(
        {
          user_id: user!.id,
          ...payload,
        },
        { onConflict: "user_id,target_date,target_type,life_routine_id" },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dayOverrides(user!.id, date),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("routine_day_overrides")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dayOverrides(user!.id, date),
      });
    },
  });

  return (
    <Card className="h-fit p-5">
      <h2 className="text-sm font-semibold text-notion-text">今日だけ変更</h2>
      <p className="mt-1 text-xs leading-relaxed text-notion-muted">
        今日の生活リズムだけ上書きします。空き時間は自動で再計算されます。
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <Label>変更対象</Label>
          <Select
            value={targetType}
            onChange={(e) =>
              setTargetType(e.target.value as "wake" | "sleep" | "routine")
            }
          >
            <option value="wake">起床時間</option>
            <option value="sleep">就寝時間</option>
            <option value="routine">生活リズム</option>
          </Select>
        </div>

        {targetType === "routine" && (
          <div>
            <Label>生活リズム</Label>
            <Select
              value={routineId}
              onChange={(e) => setRoutineId(e.target.value)}
            >
              <option value="">選択してください</option>
              {(routinesQuery.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label ?? r.type}（{trimTime(r.preferred_time)}ごろ）
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label>変更内容</Label>
          <Select
            value={action}
            onChange={(e) => setAction(e.target.value as "modify" | "skip")}
          >
            <option value="modify">時間を変更</option>
            <option value="skip">スキップ</option>
          </Select>
        </div>

        {action === "modify" && (
          <>
            <div>
              <Label>新しい時刻</Label>
              <Input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
              />
            </div>
            {targetType === "routine" && (
              <div>
                <Label>所要時間（分）</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                />
              </div>
            )}
          </>
        )}

        <Button
          className="w-full"
          onClick={() => mutation.mutate()}
          disabled={
            mutation.isPending ||
            (targetType === "routine" && !routineId)
          }
        >
          {mutation.isPending ? "反映中..." : "今日の変更を保存"}
        </Button>

        {mutation.error && (
          <p className="text-xs text-notion-danger">
            {(mutation.error as Error).message}
          </p>
        )}
      </div>

      {(overridesQuery.data?.length ?? 0) > 0 && (
        <div className="mt-6 border-t border-notion-border pt-4">
          <p className="mb-2 text-xs font-medium text-notion-muted">
            適用中の変更
          </p>
          <ul className="space-y-2">
            {overridesQuery.data?.map((override) => (
              <li
                key={override.id}
                className="flex items-start justify-between gap-2 rounded-[4px] bg-notion-sidebar/70 px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium text-notion-text">
                    {override.target_type === "wake"
                      ? "起床"
                      : override.target_type === "sleep"
                        ? "就寝"
                        : "生活リズム"}
                  </p>
                  <p className="text-[11px] text-notion-muted">
                    {override.action === "skip"
                      ? "スキップ"
                      : `${trimTime(override.preferred_time)}ごろ`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(override.id)}
                >
                  解除
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {freeTimeResult && (
        <div className="mt-4 rounded-[4px] bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
          再計算済み: 空き時間{" "}
          {freeTimeResult.freeSlots.reduce(
            (sum, s) => sum + s.durationMinutes,
            0,
          )}
          分
        </div>
      )}
    </Card>
  );
}
