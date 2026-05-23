-- Phase 0 + Phase 1: profiles, preferences, life routines, fixed schedules, day overrides

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE routine_type AS ENUM (
  'breakfast',
  'lunch',
  'dinner',
  'bath',
  'break',
  'other'
);

CREATE TYPE applies_to_type AS ENUM ('weekday', 'weekend', 'both');

CREATE TYPE flexibility_type AS ENUM ('fixed', 'flexible');

CREATE TYPE override_target_type AS ENUM ('wake', 'sleep', 'routine');

CREATE TYPE override_action AS ENUM ('skip', 'modify');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  focus_times TEXT[] NOT NULL DEFAULT '{}',
  max_session_minutes INTEGER NOT NULL DEFAULT 60 CHECK (max_session_minutes > 0),
  wake_time_weekday TIME,
  wake_time_weekend TIME,
  sleep_time_weekday TIME,
  sleep_time_weekend TIME,
  break_frequency_minutes INTEGER CHECK (break_frequency_minutes IS NULL OR break_frequency_minutes > 0),
  break_duration_minutes INTEGER CHECK (break_duration_minutes IS NULL OR break_duration_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.life_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type routine_type NOT NULL,
  label TEXT,
  preferred_time TIME NOT NULL,
  earliest_time TIME NOT NULL,
  latest_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  flexibility flexibility_type NOT NULL DEFAULT 'flexible',
  applies_to applies_to_type NOT NULL DEFAULT 'both',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT life_routines_time_order CHECK (earliest_time <= preferred_time AND preferred_time <= latest_time)
);

CREATE TABLE public.fixed_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL CHECK (array_length(days_of_week, 1) >= 1),
  commute_minutes INTEGER NOT NULL DEFAULT 0 CHECK (commute_minutes >= 0 AND commute_minutes <= 180),
  is_editable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fixed_schedules_time_order CHECK (start_time < end_time)
);

CREATE TABLE public.routine_day_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  target_type override_target_type NOT NULL,
  life_routine_id UUID REFERENCES public.life_routines (id) ON DELETE CASCADE,
  action override_action NOT NULL,
  preferred_time TIME,
  earliest_time TIME,
  latest_time TIME,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 480)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT routine_day_overrides_routine_ref CHECK (
    (target_type = 'routine' AND life_routine_id IS NOT NULL)
    OR (target_type IN ('wake', 'sleep') AND life_routine_id IS NULL)
  ),
  CONSTRAINT routine_day_overrides_unique_target
    UNIQUE NULLS NOT DISTINCT (user_id, target_date, target_type, life_routine_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_profiles_id ON public.profiles (id);
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences (user_id);
CREATE INDEX idx_life_routines_user_id ON public.life_routines (user_id);
CREATE INDEX idx_fixed_schedules_user_id ON public.fixed_schedules (user_id);
CREATE INDEX idx_routine_day_overrides_user_date ON public.routine_day_overrides (user_id, target_date);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER life_routines_updated_at
  BEFORE UPDATE ON public.life_routines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER fixed_schedules_updated_at
  BEFORE UPDATE ON public.fixed_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER routine_day_overrides_updated_at
  BEFORE UPDATE ON public.routine_day_overrides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_day_overrides ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- user_preferences
CREATE POLICY "user_preferences_select_own"
  ON public.user_preferences FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_preferences_insert_own"
  ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_preferences_update_own"
  ON public.user_preferences FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_preferences_delete_own"
  ON public.user_preferences FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- life_routines
CREATE POLICY "life_routines_select_own"
  ON public.life_routines FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "life_routines_insert_own"
  ON public.life_routines FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "life_routines_update_own"
  ON public.life_routines FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "life_routines_delete_own"
  ON public.life_routines FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- fixed_schedules
CREATE POLICY "fixed_schedules_select_own"
  ON public.fixed_schedules FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "fixed_schedules_insert_own"
  ON public.fixed_schedules FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "fixed_schedules_update_own"
  ON public.fixed_schedules FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "fixed_schedules_delete_own"
  ON public.fixed_schedules FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- routine_day_overrides
CREATE POLICY "routine_day_overrides_select_own"
  ON public.routine_day_overrides FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "routine_day_overrides_insert_own"
  ON public.routine_day_overrides FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "routine_day_overrides_update_own"
  ON public.routine_day_overrides FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "routine_day_overrides_delete_own"
  ON public.routine_day_overrides FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
