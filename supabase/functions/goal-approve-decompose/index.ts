import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { goalDecomposeApproveSchema } from "../../../packages/core/dist/ai/schemas/goal-decompose.js";
import { createUserClient, requireAuth } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const goalId = body?.goalId as string | undefined;
  const decompose = body?.decompose;

  if (!goalId || !decompose) {
    return errorResponse("goalId と decompose が必要です");
  }

  const parsed = goalDecomposeApproveSchema.safeParse(decompose);
  if (!parsed.success) {
    return errorResponse(`検証エラー: ${parsed.error.message}`);
  }

  const userClient = createUserClient(auth.authHeader);

  const { data: goal, error: goalError } = await userClient
    .from("goals")
    .select("id, status")
    .eq("id", goalId)
    .eq("user_id", auth.userId)
    .single();

  if (goalError || !goal) {
    return errorResponse("目標が見つかりません", 404);
  }

  const output = parsed.data;

  const { error: deleteComponentsError } = await userClient
    .from("goal_components")
    .delete()
    .eq("goal_id", goalId);

  if (deleteComponentsError) {
    return errorResponse(deleteComponentsError.message, 500);
  }

  const componentRows = output.components.map((component, index) => ({
    goal_id: goalId,
    name: component.name,
    estimated_minutes: component.estimatedMinutes,
    priority: component.priority,
    phase: component.phase,
    recommended_sessions_per_week: component.recommendedSessionsPerWeek ?? null,
    sort_order: index,
  }));

  const { data: insertedComponents, error: insertComponentsError } =
    await userClient.from("goal_components").insert(componentRows).select("id, name");

  if (insertComponentsError || !insertedComponents) {
    return errorResponse(insertComponentsError?.message ?? "構成要素の保存に失敗", 500);
  }

  const componentIdByName = new Map(
    insertedComponents.map((row) => [row.name.toLowerCase(), row.id]),
  );

  const workBlockRows = output.workBlocks.map((block, index) => {
    const componentId = componentIdByName.get(block.component.toLowerCase());
    if (!componentId) {
      throw new Error(`Unknown component: ${block.component}`);
    }

    return {
      goal_id: goalId,
      component_id: componentId,
      title: block.title,
      min_minutes: block.minMinutes,
      ideal_minutes: block.idealMinutes,
      max_minutes: block.maxMinutes,
      energy: block.energy,
      is_splittable: block.isSplittable,
      preferred_time: block.preferredTime,
      requires_deep_work: block.requiresDeepWork,
      context_switch_cost: block.contextSwitchCost,
      order_type: block.orderType,
      time_menus: block.timeMenus ?? [],
      sort_order: index,
    };
  });

  const { error: insertBlocksError } = await userClient
    .from("work_block_templates")
    .insert(workBlockRows);

  if (insertBlocksError) {
    return errorResponse(insertBlocksError.message, 500);
  }

  const { error: updateGoalError } = await userClient
    .from("goals")
    .update({
      estimated_total_minutes: output.goal.estimatedTotalMinutes,
      feasibility: output.goal.feasibility,
      ai_summary: output.goal.summary,
      status: "active",
    })
    .eq("id", goalId);

  if (updateGoalError) {
    return errorResponse(updateGoalError.message, 500);
  }

  return jsonResponse({ goalId, status: "active" });
});
