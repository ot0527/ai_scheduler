import { clsx, type ClassValue } from "clsx";
import { trimDbTime } from "@ai-scheduler/core";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated trimDbTime を直接使用してください */
export const trimTime = trimDbTime;

/** 今日の日付を "YYYY-MM-DD" 形式で返す（ローカルタイムゾーン） */
export function todayDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
