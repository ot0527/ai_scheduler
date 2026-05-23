/**
 * スケジューリングで共通利用する定数。
 * UI ラベルとロジックの両方から参照し、重複定義を防ぐ。
 */

/** 1日の分数（24時間） */
export const MINUTES_PER_DAY = 24 * 60;

/** 起床・就寝のデフォルト値（ユーザー未設定時のフォールバック） */
export const DEFAULT_WAKE_TIME = "07:00" as const;
export const DEFAULT_SLEEP_TIME = "23:00" as const;

/** 「ごろ」入力のデフォルト許容幅（分） */
export const DEFAULT_FLEXIBILITY_MINUTES = 30;

/** 生活リズム種別の表示ラベル */
export const ROUTINE_TYPE_LABELS = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  bath: "風呂",
  break: "休憩",
  other: "その他",
} as const;

export type RoutineTypeKey = keyof typeof ROUTINE_TYPE_LABELS;

/**
 * 生活リズムの表示名を解決する。
 * カスタムラベルがあれば優先し、なければ種別の既定ラベルを返す。
 */
export function resolveRoutineLabel(
  type: string,
  customLabel: string | null | undefined,
): string {
  if (customLabel) return customLabel;
  return ROUTINE_TYPE_LABELS[type as RoutineTypeKey] ?? type;
}
