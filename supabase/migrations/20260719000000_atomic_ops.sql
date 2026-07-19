-- アトミック化: トークン使用量・進捗分数の加算を read-modify-write から
-- 単一 UPDATE の RPC へ移行し、並行リクエストでの加算消失を防ぐ。
-- また目標分解の承認(削除→挿入→更新)を単一トランザクションの RPC 化する。

-- ---------------------------------------------------------------------------
-- 月間トークン使用量の加算(Edge Function / service_role 専用)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_tokens_used(
  p_user_id UUID,
  p_tokens INTEGER
)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE public.user_ai_settings
  SET tokens_used_this_month = tokens_used_this_month + GREATEST(p_tokens, 0)
  WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.increment_tokens_used(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_tokens_used(UUID, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 目標・週次予算の進捗加算(SECURITY INVOKER: RLS で本人の行のみ)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_goal_progress(
  p_goal_id UUID,
  p_delta INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.goals
  SET completed_minutes = GREATEST(0, completed_minutes + p_delta)
  WHERE id = p_goal_id;

  -- 0 行更新（存在しない ID / RLS で不可視な ID）を成功扱いにしない
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'goal not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_goal_progress(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_goal_progress(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_budget_progress(
  p_goal_id UUID,
  p_period_start DATE,
  p_delta INTEGER
)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE public.goal_budgets
  SET completed_minutes = GREATEST(0, completed_minutes + p_delta)
  WHERE goal_id = p_goal_id
    AND period_start = p_period_start;
$$;

REVOKE ALL ON FUNCTION public.increment_budget_progress(UUID, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_budget_progress(UUID, DATE, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- ブロック完了記録（ブロック・目標・週次予算を単一トランザクションで更新）
-- ブロック行を FOR UPDATE でロックし、DB 上の旧 actual_minutes から差分を計算する。
-- クライアント保持の旧値に依存しないため、並行記録・再試行でも二重加算しない。
-- SECURITY INVOKER: RLS により本人の行のみ操作可能
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_block_completion(
  p_block_id UUID,
  p_status scheduled_block_status,
  p_actual_minutes INTEGER,
  p_period_start DATE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_actual INTEGER;
  v_goal_id UUID;
  v_delta INTEGER;
  v_count INTEGER;
BEGIN
  IF p_actual_minutes < 0 THEN
    RAISE EXCEPTION 'actual minutes must be non-negative';
  END IF;

  -- 行ロックにより同一ブロックへの並行記録を直列化する
  SELECT actual_minutes, goal_id
  INTO v_old_actual, v_goal_id
  FROM public.scheduled_blocks
  WHERE id = p_block_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scheduled block not found';
  END IF;

  UPDATE public.scheduled_blocks
  SET status = p_status,
      actual_minutes = p_actual_minutes
  WHERE id = p_block_id;

  v_delta := p_actual_minutes - v_old_actual;

  IF v_delta <> 0 THEN
    UPDATE public.goals
    SET completed_minutes = GREATEST(0, completed_minutes + v_delta)
    WHERE id = v_goal_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'goal not found';
    END IF;

    -- 週次予算行は未計算の場合があるため 0 行更新を許容する
    UPDATE public.goal_budgets
    SET completed_minutes = GREATEST(0, completed_minutes + v_delta)
    WHERE goal_id = v_goal_id
      AND period_start = p_period_start;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_block_completion(UUID, scheduled_block_status, INTEGER, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_block_completion(UUID, scheduled_block_status, INTEGER, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- 目標分解の承認をトランザクション化
-- payload は Edge Function 側で Zod 検証済み(goalDecomposeApproveSchema)
-- SECURITY INVOKER のため RLS により本人の目標のみ操作可能
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_goal_decompose(
  p_goal_id UUID,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_block_count INTEGER;
BEGIN
  UPDATE public.goals
  SET estimated_total_minutes = (p_payload -> 'goal' ->> 'estimatedTotalMinutes')::INTEGER,
      feasibility = (p_payload -> 'goal' ->> 'feasibility')::feasibility_type,
      ai_summary = p_payload -> 'goal' ->> 'summary',
      status = 'active'
  WHERE id = p_goal_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'goal not found';
  END IF;

  -- 既存の構成要素を削除(work_block_templates は CASCADE で削除)
  DELETE FROM public.goal_components WHERE goal_id = p_goal_id;

  INSERT INTO public.goal_components (
    goal_id, name, estimated_minutes, priority, phase,
    recommended_sessions_per_week, sort_order
  )
  SELECT
    p_goal_id,
    comp ->> 'name',
    (comp ->> 'estimatedMinutes')::INTEGER,
    (comp ->> 'priority')::goal_priority,
    (comp ->> 'phase')::goal_phase,
    (comp ->> 'recommendedSessionsPerWeek')::INTEGER,
    (ord - 1)::INTEGER
  FROM jsonb_array_elements(p_payload -> 'components') WITH ORDINALITY AS c(comp, ord);

  INSERT INTO public.work_block_templates (
    goal_id, component_id, title, min_minutes, ideal_minutes, max_minutes,
    energy, is_splittable, preferred_time, requires_deep_work,
    context_switch_cost, order_type, time_menus, sort_order
  )
  SELECT
    p_goal_id,
    gc.id,
    blk ->> 'title',
    (blk ->> 'minMinutes')::INTEGER,
    (blk ->> 'idealMinutes')::INTEGER,
    (blk ->> 'maxMinutes')::INTEGER,
    (blk ->> 'energy')::energy_level,
    (blk ->> 'isSplittable')::BOOLEAN,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(blk -> 'preferredTime')),
      '{}'::TEXT[]
    ),
    COALESCE((blk ->> 'requiresDeepWork')::BOOLEAN, false),
    COALESCE((blk ->> 'contextSwitchCost')::context_switch_cost, 'medium'),
    COALESCE((blk ->> 'orderType')::order_type, 'flexible'),
    COALESCE(blk -> 'timeMenus', '[]'::JSONB),
    (ord - 1)::INTEGER
  FROM jsonb_array_elements(p_payload -> 'workBlocks') WITH ORDINALITY AS b(blk, ord)
  JOIN public.goal_components gc
    ON gc.goal_id = p_goal_id
   AND lower(gc.name) = lower(blk ->> 'component');

  GET DIAGNOSTICS v_block_count = ROW_COUNT;
  IF v_block_count <> jsonb_array_length(p_payload -> 'workBlocks') THEN
    RAISE EXCEPTION 'unknown component reference';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_goal_decompose(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_goal_decompose(UUID, JSONB) TO authenticated;
