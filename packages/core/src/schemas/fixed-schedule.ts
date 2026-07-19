import { z } from "zod";
import { TIME_REGEX } from "./common.js";

/** 固定予定登録フォームの Zod スキーマ。 */
export const fixedScheduleFormSchema = z
  .object({
    title: z.string().min(1).max(200),
    startTime: z.string().regex(TIME_REGEX),
    endTime: z.string().regex(TIME_REGEX),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    commuteMinutes: z.number().int().min(0).max(180).default(0),
    isEditable: z.boolean().default(false),
  })
  .refine(
    // 終了が開始以前の場合は日跨ぎ（夜勤等）として扱うため、同時刻のみ拒否する
    (data) => data.startTime !== data.endTime,
    { message: "開始時刻と終了時刻は異なる時刻にしてください（終了が開始より前の場合は日跨ぎとして扱います）" },
  );

export type FixedScheduleFormInput = z.infer<typeof fixedScheduleFormSchema>;

export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 曜日番号配列を表示用文字列に変換する（例: [1,3,5] → "月・水・金"） */
export function formatDaysOfWeek(days: number[]): string {
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join("・");
}
