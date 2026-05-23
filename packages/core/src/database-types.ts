/**
 * Supabase 生成型（手動管理）。
 * `supabase gen types typescript` の出力をここに反映する。
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type DefaultSchema = {
  Tables: {
    profiles: {
      Row: {
        id: string;
        name: string | null;
        timezone: string;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id: string;
        name?: string | null;
        timezone?: string;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        name?: string | null;
        timezone?: string;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    user_preferences: {
      Row: {
        id: string;
        user_id: string;
        focus_times: string[];
        max_session_minutes: number;
        wake_time_weekday: string | null;
        wake_time_weekend: string | null;
        sleep_time_weekday: string | null;
        sleep_time_weekend: string | null;
        break_frequency_minutes: number | null;
        break_duration_minutes: number | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        focus_times?: string[];
        max_session_minutes?: number;
        wake_time_weekday?: string | null;
        wake_time_weekend?: string | null;
        sleep_time_weekday?: string | null;
        sleep_time_weekend?: string | null;
        break_frequency_minutes?: number | null;
        break_duration_minutes?: number | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        focus_times?: string[];
        max_session_minutes?: number;
        wake_time_weekday?: string | null;
        wake_time_weekend?: string | null;
        sleep_time_weekday?: string | null;
        sleep_time_weekend?: string | null;
        break_frequency_minutes?: number | null;
        break_duration_minutes?: number | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    life_routines: {
      Row: {
        id: string;
        user_id: string;
        type: "breakfast" | "lunch" | "dinner" | "bath" | "break" | "other";
        label: string | null;
        preferred_time: string;
        earliest_time: string;
        latest_time: string;
        duration_minutes: number;
        flexibility: "fixed" | "flexible";
        applies_to: "weekday" | "weekend" | "both";
        sort_order: number;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        type: "breakfast" | "lunch" | "dinner" | "bath" | "break" | "other";
        label?: string | null;
        preferred_time: string;
        earliest_time: string;
        latest_time: string;
        duration_minutes: number;
        flexibility?: "fixed" | "flexible";
        applies_to?: "weekday" | "weekend" | "both";
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        type?: "breakfast" | "lunch" | "dinner" | "bath" | "break" | "other";
        label?: string | null;
        preferred_time?: string;
        earliest_time?: string;
        latest_time?: string;
        duration_minutes?: number;
        flexibility?: "fixed" | "flexible";
        applies_to?: "weekday" | "weekend" | "both";
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    fixed_schedules: {
      Row: {
        id: string;
        user_id: string;
        title: string;
        start_time: string;
        end_time: string;
        days_of_week: number[];
        commute_minutes: number;
        is_editable: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        title: string;
        start_time: string;
        end_time: string;
        days_of_week: number[];
        commute_minutes?: number;
        is_editable?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        title?: string;
        start_time?: string;
        end_time?: string;
        days_of_week?: number[];
        commute_minutes?: number;
        is_editable?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    routine_day_overrides: {
      Row: {
        id: string;
        user_id: string;
        target_date: string;
        target_type: "wake" | "sleep" | "routine";
        life_routine_id: string | null;
        action: "skip" | "modify";
        preferred_time: string | null;
        earliest_time: string | null;
        latest_time: string | null;
        duration_minutes: number | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        target_date: string;
        target_type: "wake" | "sleep" | "routine";
        life_routine_id?: string | null;
        action: "skip" | "modify";
        preferred_time?: string | null;
        earliest_time?: string | null;
        latest_time?: string | null;
        duration_minutes?: number | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        target_date?: string;
        target_type?: "wake" | "sleep" | "routine";
        life_routine_id?: string | null;
        action?: "skip" | "modify";
        preferred_time?: string | null;
        earliest_time?: string | null;
        latest_time?: string | null;
        duration_minutes?: number | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
  };
  Views: Record<string, never>;
  Functions: Record<string, never>;
  Enums: {
    routine_type: "breakfast" | "lunch" | "dinner" | "bath" | "break" | "other";
    applies_to_type: "weekday" | "weekend" | "both";
    flexibility_type: "fixed" | "flexible";
    override_target_type: "wake" | "sleep" | "routine";
    override_action: "skip" | "modify";
  };
  CompositeTypes: Record<string, never>;
};

export type Database = {
  public: DefaultSchema;
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
