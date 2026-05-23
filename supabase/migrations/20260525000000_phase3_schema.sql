-- Phase 3: goal_budgets, schedules, scheduled_blocks, alerts

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE goal_budget_status AS ENUM (
  'on_track',
  'behind',
  'at_risk',
  'over_allocated'
);

CREATE TYPE schedule_status AS ENUM (
  'draft',
  'approved',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE scheduled_block_status AS ENUM (
  'planned',
  'done',
  'partial',
  'skipped',
  'rescheduled'
);

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.goal_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  required_minutes INTEGER NOT NULL CHECK (required_minutes >= 0),
  allocated_minutes INTEGER NOT NULL CHECK (allocated_minutes >= 0),
  completed_minutes INTEGER NOT NULL DEFAULT 0 CHECK (completed_minutes >= 0),
  status goal_budget_status NOT NULL DEFAULT 'on_track',
  warning_message TEXT CHECK (
    warning_message IS NULL OR char_length(warning_message) <= 500
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT goal_budgets_period_order CHECK (period_start <= period_end),
  CONSTRAINT goal_budgets_unique_period UNIQUE (goal_id, period_start)
);

CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  status schedule_status NOT NULL DEFAULT 'draft',
  summary TEXT CHECK (summary IS NULL OR char_length(summary) <= 1000),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedules_unique_user_date UNIQUE (user_id, target_date)
);

CREATE TABLE public.scheduled_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules (id) ON DELETE CASCADE,
  work_block_template_id UUID REFERENCES public.work_block_templates (id) ON DELETE SET NULL,
  goal_id UUID NOT NULL REFERENCES public.goals (id) ON DELETE CASCADE,
  component_id UUID REFERENCES public.goal_components (id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  planned_minutes INTEGER NOT NULL CHECK (planned_minutes > 0 AND planned_minutes <= 480),
  actual_minutes INTEGER NOT NULL DEFAULT 0 CHECK (actual_minutes >= 0),
  status scheduled_block_status NOT NULL DEFAULT 'planned',
  selected_menu_item TEXT CHECK (
    selected_menu_item IS NULL OR char_length(selected_menu_item) <= 500
  ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_blocks_time_order CHECK (start_time < end_time)
);

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals (id) ON DELETE CASCADE,
  severity alert_severity NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_goal_budgets_user_id ON public.goal_budgets (user_id);
CREATE INDEX idx_goal_budgets_goal_period ON public.goal_budgets (goal_id, period_start DESC);
CREATE INDEX idx_schedules_user_date ON public.schedules (user_id, target_date DESC);
CREATE INDEX idx_scheduled_blocks_schedule_id ON public.scheduled_blocks (schedule_id);
CREATE INDEX idx_alerts_user_unread ON public.alerts (user_id, is_read, created_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER goal_budgets_updated_at
  BEFORE UPDATE ON public.goal_budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER scheduled_blocks_updated_at
  BEFORE UPDATE ON public.scheduled_blocks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.goal_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- goal_budgets
CREATE POLICY "goal_budgets_select_own"
  ON public.goal_budgets FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "goal_budgets_insert_own"
  ON public.goal_budgets FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "goal_budgets_update_own"
  ON public.goal_budgets FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "goal_budgets_delete_own"
  ON public.goal_budgets FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- schedules
CREATE POLICY "schedules_select_own"
  ON public.schedules FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "schedules_insert_own"
  ON public.schedules FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "schedules_update_own"
  ON public.schedules FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "schedules_delete_own"
  ON public.schedules FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- scheduled_blocks
CREATE POLICY "scheduled_blocks_select_own"
  ON public.scheduled_blocks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = scheduled_blocks.schedule_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "scheduled_blocks_insert_own"
  ON public.scheduled_blocks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = scheduled_blocks.schedule_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "scheduled_blocks_update_own"
  ON public.scheduled_blocks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = scheduled_blocks.schedule_id
        AND s.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = scheduled_blocks.schedule_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "scheduled_blocks_delete_own"
  ON public.scheduled_blocks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = scheduled_blocks.schedule_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- alerts
CREATE POLICY "alerts_select_own"
  ON public.alerts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "alerts_insert_own"
  ON public.alerts FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "alerts_update_own"
  ON public.alerts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "alerts_delete_own"
  ON public.alerts FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
