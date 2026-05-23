import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GOAL_CATEGORY_LABELS,
  GOAL_PRIORITY_LABELS,
  PREFERRED_TIME_LABELS,
  goalFormSchema,
} from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { Loader2 } from "lucide-react";

const defaultDeadline = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().slice(0, 10);
};

export function GoalFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<
    "study" | "creative" | "exercise" | "work" | "side_business" | "household" | "other"
  >("study");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [currentStatus, setCurrentStatus] = useState("");
  const [targetCondition, setTargetCondition] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [weeklyHours, setWeeklyHours] = useState(8);
  const [avoidMorning, setAvoidMorning] = useState(false);
  const [avoidNight, setAvoidNight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const avoidTimeSlots = [
        ...(avoidMorning ? (["morning"] as const) : []),
        ...(avoidNight ? (["night"] as const) : []),
      ];

      const parsed = goalFormSchema.parse({
        title,
        category,
        deadline,
        currentStatus: currentStatus || undefined,
        targetCondition,
        priority,
        weeklyAvailableMinutes: weeklyHours * 60,
        avoidTimeSlots,
      });

      const { data, error: insertError } = await supabase
        .from("goals")
        .insert({
          user_id: user!.id,
          title: parsed.title,
          category: parsed.category,
          deadline: parsed.deadline,
          current_status: parsed.currentStatus ?? null,
          target_condition: parsed.targetCondition,
          priority: parsed.priority,
          weekly_available_minutes: parsed.weeklyAvailableMinutes,
          avoid_time_slots: parsed.avoidTimeSlots,
          status: "draft",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      return data.id as string;
    },
    onSuccess: async (goalId) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goals(user!.id),
      });
      navigate(`/goals/${goalId}/decompose`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    },
  });

  return (
    <div>
      <PageHeader
        title="目標を追加"
        description="達成したいことを登録します。保存後、AI 分解画面へ進みます。"
        action={
          <Button variant="secondary" onClick={() => navigate("/goals")}>
            一覧へ
          </Button>
        }
      />

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>目標名</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 英検2級に合格する"
            />
          </div>

          <div>
            <Label>カテゴリ</Label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              {Object.entries(GOAL_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>期限</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div>
            <Label>優先度</Label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              {Object.entries(GOAL_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>週に使える希望時間（時間）</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>現在地（任意）</Label>
            <Textarea
              rows={2}
              value={currentStatus}
              onChange={(e) => setCurrentStatus(e.target.value)}
              placeholder="例: 基礎はあるが、1年ぶりの再開"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>達成条件</Label>
            <Textarea
              rows={2}
              value={targetCondition}
              onChange={(e) => setTargetCondition(e.target.value)}
              placeholder="例: 試験で合格点以上を取る"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>避けたい時間帯</Label>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={avoidMorning}
                  onChange={(e) => setAvoidMorning(e.target.checked)}
                />
                {PREFERRED_TIME_LABELS.morning}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={avoidNight}
                  onChange={(e) => setAvoidNight(e.target.checked)}
                />
                {PREFERRED_TIME_LABELS.night}
              </label>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-notion-danger">{error}</p>
        )}

        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            保存して AI 分解へ
          </Button>
          <Button variant="secondary" onClick={() => navigate("/goals")}>
            キャンセル
          </Button>
        </div>
      </Card>
    </div>
  );
}
