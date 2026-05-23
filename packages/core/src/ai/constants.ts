/** AI 出力検証の上限値（企画書第6.4節）。 */
export const AI_LIMITS = {
  maxComponents: 50,
  maxWorkBlocks: 200,
  maxQuestions: 10,
  maxBlockMinutes: 480,
  maxTotalMinutes: 1_000_000,
  maxComponentMinutes: 500_000,
  goalDecomposePerDay: 5,
  /** 目標分解の Gemini / OpenAI 出力トークン上限 */
  goalDecomposeMaxOutputTokens: 8192,
  /** プロンプト上の推奨上限（JSON 肥大化・途切れ防止） */
  goalDecomposePromptMaxComponents: 12,
  goalDecomposePromptMaxWorkBlocks: 24,
  goalDecomposePromptMaxSummaryChars: 300,
  reschedulePerDay: 3,
  rescheduleMaxOutputTokens: 4096,
  reschedulePromptMaxRecommendations: 5,
  chatPerDay: 20,
  chatMaxOutputTokens: 2048,
  chatMaxMessageChars: 2000,
  chatMaxReplyChars: 2000,
  chatMaxHistoryItems: 10,
  chatMaxSuggestedActions: 3,
} as const;

export const GOAL_CATEGORY_LABELS: Record<
  "study" | "creative" | "exercise" | "work" | "side_business" | "household" | "other",
  string
> = {
  study: "勉強",
  creative: "創作",
  exercise: "運動",
  work: "仕事",
  side_business: "副業",
  household: "家事",
  other: "その他",
};

export const GOAL_PRIORITY_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const GOAL_STATUS_LABELS: Record<
  "draft" | "active" | "completed" | "archived",
  string
> = {
  draft: "下書き",
  active: "進行中",
  completed: "完了",
  archived: "アーカイブ",
};

export const GOAL_PHASE_LABELS: Record<"early" | "middle" | "late", string> = {
  early: "序盤",
  middle: "中盤",
  late: "終盤",
};

export const ENERGY_LEVEL_LABELS: Record<"low" | "medium" | "high", string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export const FEASIBILITY_LABELS: Record<
  "possible" | "challenging" | "unlikely",
  string
> = {
  possible: "達成可能",
  challenging: "やや厳しい",
  unlikely: "達成困難",
};

export const PREFERRED_TIME_LABELS: Record<
  "morning" | "afternoon" | "evening" | "night" | "commute" | "weekend",
  string
> = {
  morning: "朝",
  afternoon: "昼",
  evening: "夕方",
  night: "夜",
  commute: "通勤中",
  weekend: "休日",
};

export const AI_PROVIDER_LABELS: Record<"openai" | "gemini", string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
};

export const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"] as const;
export const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
] as const;

export const GEMINI_MODEL_LABELS: Record<(typeof GEMINI_MODELS)[number], string> = {
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
};
