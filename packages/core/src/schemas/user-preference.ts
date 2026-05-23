import { z } from "zod";
import { TIME_REGEX } from "./common.js";

export const focusTimeSchema = z.enum(["morning", "day", "night", "late_night"]);

/** ユーザー基本設定フォームの Zod スキーマ。 */
export const userPreferenceFormSchema = z.object({
  focusTimes: z.array(focusTimeSchema).default([]),
  maxSessionMinutes: z.number().int().min(15).max(480).default(60),
  wakeTimeWeekday: z.string().regex(TIME_REGEX).nullable(),
  wakeTimeWeekend: z.string().regex(TIME_REGEX).nullable(),
  sleepTimeWeekday: z.string().regex(TIME_REGEX).nullable(),
  sleepTimeWeekend: z.string().regex(TIME_REGEX).nullable(),
  breakFrequencyMinutes: z.number().int().min(15).max(480).nullable().optional(),
  breakDurationMinutes: z.number().int().min(5).max(60).nullable().optional(),
});

export type UserPreferenceFormInput = z.infer<typeof userPreferenceFormSchema>;

export const FOCUS_TIME_LABELS: Record<
  z.infer<typeof focusTimeSchema>,
  string
> = {
  morning: "朝",
  day: "昼",
  night: "夜",
  late_night: "深夜",
};
