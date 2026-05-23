/**
 * TanStack Query のキーを一箇所に集約する。
 * Phase 追加時のキャッシュ無効化漏れを防ぐ。
 */
export const queryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  userPreferences: (userId: string) => ["user_preferences", userId] as const,
  lifeRoutines: (userId: string) => ["life_routines", userId] as const,
  fixedSchedules: (userId: string) => ["fixed_schedules", userId] as const,
  dayOverrides: (userId: string, date: string) =>
    ["routine_day_overrides", userId, date] as const,
  goals: (userId: string) => ["goals", userId] as const,
  goal: (userId: string, goalId: string) => ["goals", userId, goalId] as const,
  aiSettings: (userId: string) => ["user_ai_settings", userId] as const,
};
