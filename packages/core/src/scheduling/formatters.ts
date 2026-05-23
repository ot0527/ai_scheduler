import { formatMinutesToTime } from "./time-utils.js";

/**
 * 分単位の時間帯を表示用の文字列に変換する。
 *
 * @example formatTimeRange(450, 540) // "07:30 – 09:00"
 */
export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return `${formatMinutesToTime(startMinutes)} – ${formatMinutesToTime(endMinutes)}`;
}

/**
 * 所要時間（分）を日本語の表示文字列に変換する。
 *
 * @example formatDuration(90) // "1時間30分"
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分`;
  if (mins === 0) return `${hours}時間`;
  return `${hours}時間${mins}分`;
}
