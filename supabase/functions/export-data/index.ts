import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createUserClient,
  requireAuth,
} from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * ユーザー自身のデータを JSON でエクスポートする。
 * API キー本体は含めず、下4桁のみ返す。
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const userClient = createUserClient(auth.authHeader);

  const [
    profile,
    preferences,
    routines,
    fixedSchedules,
    goals,
    aiSettings,
    budgets,
    schedules,
    alerts,
    aiLogs,
    dayOverrides,
  ] = await Promise.all([
    userClient.from("profiles").select("*").eq("id", auth.userId).maybeSingle(),
    userClient
      .from("user_preferences")
      .select("*")
      .eq("user_id", auth.userId)
      .maybeSingle(),
    userClient
      .from("life_routines")
      .select("*")
      .eq("user_id", auth.userId)
      .order("sort_order"),
    userClient
      .from("fixed_schedules")
      .select("*")
      .eq("user_id", auth.userId),
    userClient.from("goals").select("*").eq("user_id", auth.userId),
    userClient
      .from("user_ai_settings")
      .select(
        "provider, model, api_key_last4, monthly_token_limit, tokens_used_this_month, usage_reset_at, ai_tone, created_at, updated_at",
      )
      .eq("user_id", auth.userId)
      .maybeSingle(),
    userClient.from("goal_budgets").select("*").eq("user_id", auth.userId),
    userClient.from("schedules").select("*").eq("user_id", auth.userId),
    userClient.from("alerts").select("*").eq("user_id", auth.userId),
    userClient
      .from("ai_request_logs")
      .select(
        "request_type, input_summary_masked, output_summary_masked, provider, token_usage, created_at",
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(500),
    userClient
      .from("routine_day_overrides")
      .select("*")
      .eq("user_id", auth.userId),
  ]);

  const goalIds = (goals.data ?? []).map((g) => g.id);
  let components: unknown[] = [];
  let workBlocks: unknown[] = [];
  let scheduledBlocks: unknown[] = [];

  if (goalIds.length > 0) {
    const [compRes, blockRes] = await Promise.all([
      userClient.from("goal_components").select("*").in("goal_id", goalIds),
      userClient
        .from("work_block_templates")
        .select("*")
        .in("goal_id", goalIds),
    ]);
    components = compRes.data ?? [];
    workBlocks = blockRes.data ?? [];
  }

  const scheduleIds = (schedules.data ?? []).map((s) => s.id);
  if (scheduleIds.length > 0) {
    const { data } = await userClient
      .from("scheduled_blocks")
      .select("*")
      .in("schedule_id", scheduleIds);
    scheduledBlocks = data ?? [];
  }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    profile: profile.data,
    preferences: preferences.data,
    lifeRoutines: routines.data ?? [],
    fixedSchedules: fixedSchedules.data ?? [],
    routineDayOverrides: dayOverrides.data ?? [],
    goals: goals.data ?? [],
    goalComponents: components,
    workBlockTemplates: workBlocks,
    goalBudgets: budgets.data ?? [],
    schedules: schedules.data ?? [],
    scheduledBlocks,
    alerts: alerts.data ?? [],
    aiSettings: aiSettings.data,
    aiRequestLogs: aiLogs.data ?? [],
  };

  return jsonResponse(exportPayload);
});
