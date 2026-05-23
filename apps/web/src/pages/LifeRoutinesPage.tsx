import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ROUTINE_TYPE_LABELS,
  lifeRoutineFormSchema,
} from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { useLifeRoutines } from "@/hooks/useScheduleData";
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
  Select,
} from "@/components/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";

export function LifeRoutinesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routinesQuery = useLifeRoutines();

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<
    "breakfast" | "lunch" | "dinner" | "bath" | "break" | "other"
  >("dinner");
  const [label, setLabel] = useState("");
  const [preferredTime, setPreferredTime] = useState("20:00");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [flexibilityMinutes, setFlexibilityMinutes] = useState(30);
  const [appliesTo, setAppliesTo] = useState<"weekday" | "weekend" | "both">(
    "both",
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = lifeRoutineFormSchema.parse({
        type,
        label: label || undefined,
        preferredTime,
        durationMinutes,
        flexibilityMinutes,
        appliesTo,
      });

      const { error } = await supabase.from("life_routines").insert({
        user_id: user!.id,
        type: parsed.type,
        label: parsed.label ?? null,
        preferred_time: parsed.preferredTime,
        earliest_time: parsed.earliestTime,
        latest_time: parsed.latestTime,
        duration_minutes: parsed.durationMinutes,
        flexibility: parsed.flexibility,
        applies_to: parsed.appliesTo,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      setShowForm(false);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.lifeRoutines(user!.id),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("life_routines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.lifeRoutines(user!.id),
      });
    },
  });

  if (routinesQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="生活リズム"
        description="食事・風呂など「ごろ」で動く生活予定を登録します。±30分の許容幅が自動計算されます。"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/")}>
              ホームへ
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        }
      />

      {showForm && (
        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-sm font-semibold">生活リズムを追加</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>種類</Label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                {Object.entries(ROUTINE_TYPE_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>ラベル（任意）</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="例: 夕食"
              />
            </div>
            <div>
              <Label>希望時刻（ごろ）</Label>
              <Input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
              />
            </div>
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
            <div>
              <Label>許容幅（分）</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={flexibilityMinutes}
                onChange={(e) =>
                  setFlexibilityMinutes(Number(e.target.value))
                }
              />
            </div>
            <div>
              <Label>適用日</Label>
              <Select
                value={appliesTo}
                onChange={(e) =>
                  setAppliesTo(e.target.value as typeof appliesTo)
                }
              >
                <option value="both">毎日</option>
                <option value="weekday">平日のみ</option>
                <option value="weekend">休日のみ</option>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              保存
            </Button>
          </div>
        </Card>
      )}

      {(routinesQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="生活リズムがまだありません"
          description="夕食 20:00ごろ、風呂 22:30ごろ などを登録しましょう。"
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              最初の生活リズムを追加
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {routinesQuery.data?.map((routine) => (
            <Card key={routine.id} className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-notion-text">
                    {routine.label ?? ROUTINE_TYPE_LABELS[routine.type]}
                  </p>
                  <Badge tone="neutral">
                    {routine.applies_to === "both"
                      ? "毎日"
                      : routine.applies_to === "weekday"
                        ? "平日"
                        : "休日"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-notion-muted">
                  {trimTime(routine.preferred_time)}ごろ ·{" "}
                  {routine.duration_minutes}分 · 許容{" "}
                  {trimTime(routine.earliest_time)}–
                  {trimTime(routine.latest_time)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(routine.id)}
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
