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
        notification_settings: Json;
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
        notification_settings?: Json;
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
        notification_settings?: Json;
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
    goals: {
      Row: {
        id: string;
        user_id: string;
        title: string;
        category:
          | "study"
          | "creative"
          | "exercise"
          | "work"
          | "side_business"
          | "household"
          | "other";
        deadline: string;
        current_status: string | null;
        target_condition: string;
        priority: "high" | "medium" | "low";
        weekly_available_minutes: number;
        avoid_time_slots: string[];
        estimated_total_minutes: number | null;
        completed_minutes: number;
        feasibility: "possible" | "challenging" | "unlikely" | null;
        ai_summary: string | null;
        status: "draft" | "active" | "completed" | "archived";
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        title: string;
        category?:
          | "study"
          | "creative"
          | "exercise"
          | "work"
          | "side_business"
          | "household"
          | "other";
        deadline: string;
        current_status?: string | null;
        target_condition: string;
        priority?: "high" | "medium" | "low";
        weekly_available_minutes?: number;
        avoid_time_slots?: string[];
        estimated_total_minutes?: number | null;
        completed_minutes?: number;
        feasibility?: "possible" | "challenging" | "unlikely" | null;
        ai_summary?: string | null;
        status?: "draft" | "active" | "completed" | "archived";
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        title?: string;
        category?:
          | "study"
          | "creative"
          | "exercise"
          | "work"
          | "side_business"
          | "household"
          | "other";
        deadline?: string;
        current_status?: string | null;
        target_condition?: string;
        priority?: "high" | "medium" | "low";
        weekly_available_minutes?: number;
        avoid_time_slots?: string[];
        estimated_total_minutes?: number | null;
        completed_minutes?: number;
        feasibility?: "possible" | "challenging" | "unlikely" | null;
        ai_summary?: string | null;
        status?: "draft" | "active" | "completed" | "archived";
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    goal_components: {
      Row: {
        id: string;
        goal_id: string;
        name: string;
        estimated_minutes: number;
        completed_minutes: number;
        priority: "high" | "medium" | "low";
        phase: "early" | "middle" | "late";
        recommended_sessions_per_week: number | null;
        sort_order: number;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        goal_id: string;
        name: string;
        estimated_minutes: number;
        completed_minutes?: number;
        priority?: "high" | "medium" | "low";
        phase?: "early" | "middle" | "late";
        recommended_sessions_per_week?: number | null;
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        goal_id?: string;
        name?: string;
        estimated_minutes?: number;
        completed_minutes?: number;
        priority?: "high" | "medium" | "low";
        phase?: "early" | "middle" | "late";
        recommended_sessions_per_week?: number | null;
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    work_block_templates: {
      Row: {
        id: string;
        goal_id: string;
        component_id: string;
        title: string;
        min_minutes: number;
        ideal_minutes: number;
        max_minutes: number;
        energy: "low" | "medium" | "high";
        is_splittable: boolean;
        preferred_time: string[];
        requires_deep_work: boolean;
        context_switch_cost: "low" | "medium" | "high";
        order_type: "fixed" | "flexible" | "user_choice";
        time_menus: Json;
        sort_order: number;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        goal_id: string;
        component_id: string;
        title: string;
        min_minutes: number;
        ideal_minutes: number;
        max_minutes: number;
        energy?: "low" | "medium" | "high";
        is_splittable?: boolean;
        preferred_time?: string[];
        requires_deep_work?: boolean;
        context_switch_cost?: "low" | "medium" | "high";
        order_type?: "fixed" | "flexible" | "user_choice";
        time_menus?: Json;
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        goal_id?: string;
        component_id?: string;
        title?: string;
        min_minutes?: number;
        ideal_minutes?: number;
        max_minutes?: number;
        energy?: "low" | "medium" | "high";
        is_splittable?: boolean;
        preferred_time?: string[];
        requires_deep_work?: boolean;
        context_switch_cost?: "low" | "medium" | "high";
        order_type?: "fixed" | "flexible" | "user_choice";
        time_menus?: Json;
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    user_ai_settings: {
      Row: {
        id: string;
        user_id: string;
        provider: "openai" | "gemini";
        model: string;
        api_key_ref: string | null;
        api_key_last4: string | null;
        monthly_token_limit: number | null;
        tokens_used_this_month: number;
        usage_reset_at: string;
        ai_tone: "polite" | "casual" | "concise";
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        provider?: "openai" | "gemini";
        model?: string;
        api_key_ref?: string | null;
        api_key_last4?: string | null;
        monthly_token_limit?: number | null;
        tokens_used_this_month?: number;
        usage_reset_at?: string;
        ai_tone?: "polite" | "casual" | "concise";
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        provider?: "openai" | "gemini";
        model?: string;
        api_key_ref?: string | null;
        api_key_last4?: string | null;
        monthly_token_limit?: number | null;
        tokens_used_this_month?: number;
        usage_reset_at?: string;
        ai_tone?: "polite" | "casual" | "concise";
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    ai_request_logs: {
      Row: {
        id: string;
        user_id: string;
        request_type: "goal_decompose" | "reschedule" | "chat" | "test_connection";
        input_summary_masked: string;
        output_summary_masked: string | null;
        provider: "openai" | "gemini";
        token_usage: Json;
        created_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        request_type: "goal_decompose" | "reschedule" | "chat" | "test_connection";
        input_summary_masked: string;
        output_summary_masked?: string | null;
        provider: "openai" | "gemini";
        token_usage?: Json;
        created_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        request_type?: "goal_decompose" | "reschedule" | "chat" | "test_connection";
        input_summary_masked?: string;
        output_summary_masked?: string | null;
        provider?: "openai" | "gemini";
        token_usage?: Json;
        created_at?: string;
      };
      Relationships: [];
    };
    goal_budgets: {
      Row: {
        id: string;
        user_id: string;
        goal_id: string;
        period_start: string;
        period_end: string;
        required_minutes: number;
        allocated_minutes: number;
        completed_minutes: number;
        status: "on_track" | "behind" | "at_risk" | "over_allocated";
        warning_message: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        goal_id: string;
        period_start: string;
        period_end: string;
        required_minutes: number;
        allocated_minutes: number;
        completed_minutes?: number;
        status?: "on_track" | "behind" | "at_risk" | "over_allocated";
        warning_message?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        goal_id?: string;
        period_start?: string;
        period_end?: string;
        required_minutes?: number;
        allocated_minutes?: number;
        completed_minutes?: number;
        status?: "on_track" | "behind" | "at_risk" | "over_allocated";
        warning_message?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    schedules: {
      Row: {
        id: string;
        user_id: string;
        target_date: string;
        status: "draft" | "approved" | "in_progress" | "completed" | "cancelled";
        summary: string | null;
        approved_at: string | null;
        fatigue_level: number | null;
        review_note: string | null;
        reviewed_at: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        target_date: string;
        status?: "draft" | "approved" | "in_progress" | "completed" | "cancelled";
        summary?: string | null;
        approved_at?: string | null;
        fatigue_level?: number | null;
        review_note?: string | null;
        reviewed_at?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        target_date?: string;
        status?: "draft" | "approved" | "in_progress" | "completed" | "cancelled";
        summary?: string | null;
        approved_at?: string | null;
        fatigue_level?: number | null;
        review_note?: string | null;
        reviewed_at?: string | null;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    scheduled_blocks: {
      Row: {
        id: string;
        schedule_id: string;
        work_block_template_id: string | null;
        goal_id: string;
        component_id: string | null;
        title: string;
        start_time: string;
        end_time: string;
        planned_minutes: number;
        actual_minutes: number;
        status: "planned" | "done" | "partial" | "skipped" | "rescheduled";
        selected_menu_item: string | null;
        sort_order: number;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        schedule_id: string;
        work_block_template_id?: string | null;
        goal_id: string;
        component_id?: string | null;
        title: string;
        start_time: string;
        end_time: string;
        planned_minutes: number;
        actual_minutes?: number;
        status?: "planned" | "done" | "partial" | "skipped" | "rescheduled";
        selected_menu_item?: string | null;
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        schedule_id?: string;
        work_block_template_id?: string | null;
        goal_id?: string;
        component_id?: string | null;
        title?: string;
        start_time?: string;
        end_time?: string;
        planned_minutes?: number;
        actual_minutes?: number;
        status?: "planned" | "done" | "partial" | "skipped" | "rescheduled";
        selected_menu_item?: string | null;
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    alerts: {
      Row: {
        id: string;
        user_id: string;
        goal_id: string | null;
        severity: "info" | "warning" | "critical";
        message: string;
        suggestions: Json;
        is_read: boolean;
        created_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        goal_id?: string | null;
        severity?: "info" | "warning" | "critical";
        message: string;
        suggestions?: Json;
        is_read?: boolean;
        created_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        goal_id?: string | null;
        severity?: "info" | "warning" | "critical";
        message?: string;
        suggestions?: Json;
        is_read?: boolean;
        created_at?: string;
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
    goal_status: "draft" | "active" | "completed" | "archived";
    goal_priority: "high" | "medium" | "low";
    goal_category:
      | "study"
      | "creative"
      | "exercise"
      | "work"
      | "side_business"
      | "household"
      | "other";
    goal_phase: "early" | "middle" | "late";
    energy_level: "low" | "medium" | "high";
    feasibility_type: "possible" | "challenging" | "unlikely";
    order_type: "fixed" | "flexible" | "user_choice";
    context_switch_cost: "low" | "medium" | "high";
    ai_provider: "openai" | "gemini";
    ai_request_type: "goal_decompose" | "reschedule" | "chat" | "test_connection";
    goal_budget_status: "on_track" | "behind" | "at_risk" | "over_allocated";
    schedule_status: "draft" | "approved" | "in_progress" | "completed" | "cancelled";
    scheduled_block_status: "planned" | "done" | "partial" | "skipped" | "rescheduled";
    alert_severity: "info" | "warning" | "critical";
  };
  CompositeTypes: Record<string, never>;
};

export type Database = {
  public: DefaultSchema;
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
