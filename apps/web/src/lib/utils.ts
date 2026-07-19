import { clsx, type ClassValue } from "clsx";
import { toDateKey, trimDbTime } from "@ai-scheduler/core";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated trimDbTime を直接使用してください */
export const trimTime = trimDbTime;

/**
 * 今日の日付を "YYYY-MM-DD" 形式で返す（ローカルタイムゾーン）。
 *
 * @deprecated core の toDateKey を直接使用してください
 */
export const todayDateString = (date = new Date()): string => toDateKey(date);
