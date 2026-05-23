import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GoalDecomposeOutput } from "@ai-scheduler/core";
import { useAuth } from "@/hooks/useAuth";
import { invokeFunction } from "@/lib/edge-functions";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";

/** ユーザーの目標一覧を取得する。 */
export function useGoals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.goals(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

/** 単一の目標と関連データを取得する。 */
export function useGoal(goalId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.goal(user?.id ?? "", goalId ?? ""),
    enabled: !!user && !!goalId,
    queryFn: async () => {
      const { data: goal, error: goalError } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId!)
        .eq("user_id", user!.id)
        .single();

      if (goalError) throw goalError;

      const { data: components, error: componentsError } = await supabase
        .from("goal_components")
        .select("*")
        .eq("goal_id", goalId!)
        .order("sort_order", { ascending: true });

      if (componentsError) throw componentsError;

      const { data: workBlocks, error: blocksError } = await supabase
        .from("work_block_templates")
        .select("*")
        .eq("goal_id", goalId!)
        .order("sort_order", { ascending: true });

      if (blocksError) throw blocksError;

      return { goal, components, workBlocks };
    },
  });
}

/** AI 設定の状態を取得する。 */
export function useAiSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.aiSettings(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      return invokeFunction<{
        configured: boolean;
        provider: "openai" | "gemini";
        model: string;
        apiKeyLast4: string | null;
        monthlyTokenLimit: number | null;
        tokensUsedThisMonth: number;
      }>("ai-settings", { method: "GET" });
    },
  });
}

/** 目標分解プレビューを AI で生成する。 */
export function useGoalDecompose() {
  return useMutation({
    mutationFn: async (goalId: string) => {
      return invokeFunction<{ goalId: string; preview: GoalDecomposeOutput }>(
        "goal-decompose",
        { body: { goalId } },
      );
    },
  });
}

/** 分解結果を承認して DB に保存する。 */
export function useApproveDecompose() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      goalId,
      decompose,
    }: {
      goalId: string;
      decompose: GoalDecomposeOutput;
    }) => {
      return invokeFunction<{ goalId: string; status: string }>(
        "goal-approve-decompose",
        { body: { goalId, decompose } },
      );
    },
    onSuccess: async (_, variables) => {
      if (!user) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goals(user.id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goal(user.id, variables.goalId),
      });
    },
  });
}

/** AI 設定を保存する（接続テスト込み）。 */
export function useSaveAiSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      provider: "openai" | "gemini";
      model: string;
      apiKey: string;
      monthlyTokenLimit?: number | null;
    }) => {
      return invokeFunction("ai-settings", { body: input });
    },
    onSuccess: async () => {
      if (!user) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.aiSettings(user.id),
      });
    },
  });
}
