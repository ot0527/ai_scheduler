-- Phase 2: goals, goal_components, work_block_templates, user_ai_settings, ai_request_logs

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE goal_status AS ENUM ('draft', 'active', 'completed', 'archived');

CREATE TYPE goal_priority AS ENUM ('high', 'medium', 'low');

CREATE TYPE goal_category AS ENUM (
  'study',
  'creative',
  'exercise',
  'work',
  'side_business',
  'household',
  'other'
);

CREATE TYPE goal_phase AS ENUM ('early', 'middle', 'late');

CREATE TYPE energy_level AS ENUM ('low', 'medium', 'high');

CREATE TYPE feasibility_type AS ENUM ('possible', 'challenging', 'unlikely');

CREATE TYPE order_type AS ENUM ('fixed', 'flexible', 'user_choice');

CREATE TYPE context_switch_cost AS ENUM ('low', 'medium', 'high');

CREATE TYPE ai_provider AS ENUM ('openai', 'gemini');

CREATE TYPE ai_request_type AS ENUM (
  'goal_decompose',
  'reschedule',
  'chat',
  'test_connection'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  category goal_category NOT NULL DEFAULT 'other',
  deadline DATE NOT NULL,
  current_status TEXT CHECK (current_status IS NULL OR char_length(current_status) <= 2000),
  target_condition TEXT NOT NULL CHECK (char_length(target_condition) <= 500),
  priority goal_priority NOT NULL DEFAULT 'medium',
  weekly_available_minutes INTEGER NOT NULL DEFAULT 240
    CHECK (weekly_available_minutes > 0 AND weekly_available_minutes <= 10080),
  avoid_time_slots TEXT[] NOT NULL DEFAULT '{}',
  estimated_total_minutes INTEGER
    CHECK (
      estimated_total_minutes IS NULL
      OR (estimated_total_minutes > 0 AND estimated_total_minutes <= 1000000)
    ),
  completed_minutes INTEGER NOT NULL DEFAULT 0 CHECK (completed_minutes >= 0),
  feasibility feasibility_type,
  ai_summary TEXT CHECK (ai_summary IS NULL OR char_length(ai_summary) <= 2000),
  status goal_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.goal_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 200),
  estimated_minutes INTEGER NOT NULL
    CHECK (estimated_minutes > 0 AND estimated_minutes <= 500000),
  completed_minutes INTEGER NOT NULL DEFAULT 0 CHECK (completed_minutes >= 0),
  priority goal_priority NOT NULL DEFAULT 'medium',
  phase goal_phase NOT NULL DEFAULT 'early',
  recommended_sessions_per_week INTEGER
    CHECK (
      recommended_sessions_per_week IS NULL
      OR (recommended_sessions_per_week >= 0 AND recommended_sessions_per_week <= 14)
    ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.work_block_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals (id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.goal_components (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  min_minutes INTEGER NOT NULL CHECK (min_minutes > 0 AND min_minutes <= 480),
  ideal_minutes INTEGER NOT NULL CHECK (ideal_minutes > 0 AND ideal_minutes <= 480),
  max_minutes INTEGER NOT NULL CHECK (max_minutes > 0 AND max_minutes <= 480),
  energy energy_level NOT NULL DEFAULT 'medium',
  is_splittable BOOLEAN NOT NULL DEFAULT true,
  preferred_time TEXT[] NOT NULL DEFAULT '{}',
  requires_deep_work BOOLEAN NOT NULL DEFAULT false,
  context_switch_cost context_switch_cost NOT NULL DEFAULT 'medium',
  order_type order_type NOT NULL DEFAULT 'flexible',
  time_menus JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_block_templates_time_order CHECK (
    min_minutes <= ideal_minutes AND ideal_minutes <= max_minutes
  )
);

CREATE TABLE public.user_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  provider ai_provider NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  api_key_ref TEXT,
  api_key_last4 TEXT CHECK (api_key_last4 IS NULL OR char_length(api_key_last4) = 4),
  monthly_token_limit INTEGER CHECK (monthly_token_limit IS NULL OR monthly_token_limit > 0),
  tokens_used_this_month INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used_this_month >= 0),
  usage_reset_at DATE NOT NULL DEFAULT (
    (date_trunc('month', now()) + interval '1 month')::date
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  request_type ai_request_type NOT NULL,
  input_summary_masked TEXT NOT NULL CHECK (char_length(input_summary_masked) <= 500),
  output_summary_masked TEXT CHECK (
    output_summary_masked IS NULL OR char_length(output_summary_masked) <= 500
  ),
  provider ai_provider NOT NULL,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_goals_user_id ON public.goals (user_id);
CREATE INDEX idx_goals_user_status ON public.goals (user_id, status);
CREATE INDEX idx_goal_components_goal_id ON public.goal_components (goal_id);
CREATE INDEX idx_work_block_templates_goal_id ON public.work_block_templates (goal_id);
CREATE INDEX idx_work_block_templates_component_id ON public.work_block_templates (component_id);
CREATE INDEX idx_user_ai_settings_user_id ON public.user_ai_settings (user_id);
CREATE INDEX idx_ai_request_logs_user_created ON public.ai_request_logs (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER goal_components_updated_at
  BEFORE UPDATE ON public.goal_components
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER work_block_templates_updated_at
  BEFORE UPDATE ON public.work_block_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER user_ai_settings_updated_at
  BEFORE UPDATE ON public.user_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Vault helpers (BYOK)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.store_user_api_key(
  p_user_id UUID,
  p_secret TEXT,
  p_secret_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF char_length(p_secret) < 8 THEN
    RAISE EXCEPTION 'Invalid API key length';
  END IF;

  SELECT vault.create_secret(p_secret, p_secret_name, p_secret) INTO v_secret_id;
  RETURN v_secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_api_key(p_secret_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_secret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.store_user_api_key(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_user_api_key(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_user_api_key(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_api_key(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_block_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;

-- goals
CREATE POLICY "goals_select_own"
  ON public.goals FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "goals_insert_own"
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "goals_update_own"
  ON public.goals FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "goals_delete_own"
  ON public.goals FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- goal_components
CREATE POLICY "goal_components_select_own"
  ON public.goal_components FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_components.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "goal_components_insert_own"
  ON public.goal_components FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_components.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "goal_components_update_own"
  ON public.goal_components FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_components.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_components.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "goal_components_delete_own"
  ON public.goal_components FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_components.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  );

-- work_block_templates
CREATE POLICY "work_block_templates_select_own"
  ON public.work_block_templates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = work_block_templates.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "work_block_templates_insert_own"
  ON public.work_block_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = work_block_templates.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "work_block_templates_update_own"
  ON public.work_block_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = work_block_templates.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = work_block_templates.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "work_block_templates_delete_own"
  ON public.work_block_templates FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = work_block_templates.goal_id
        AND g.user_id = (SELECT auth.uid())
    )
  );

-- user_ai_settings
CREATE POLICY "user_ai_settings_select_own"
  ON public.user_ai_settings FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_ai_settings_insert_own"
  ON public.user_ai_settings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_ai_settings_update_own"
  ON public.user_ai_settings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_ai_settings_delete_own"
  ON public.user_ai_settings FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ai_request_logs (読み取りのみ。INSERT は service_role 経由)
CREATE POLICY "ai_request_logs_select_own"
  ON public.ai_request_logs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
