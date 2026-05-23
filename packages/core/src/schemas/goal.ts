import { z } from "zod";

export const goalCategorySchema = z.enum([
  "study",
  "creative",
  "exercise",
  "work",
  "side_business",
  "household",
  "other",
]);

export const goalPrioritySchema = z.enum(["high", "medium", "low"]);

export const goalStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "archived",
]);

export const goalPhaseSchema = z.enum(["early", "middle", "late"]);

export const energyLevelSchema = z.enum(["low", "medium", "high"]);

export const feasibilitySchema = z.enum([
  "possible",
  "challenging",
  "unlikely",
]);

export const orderTypeSchema = z.enum(["fixed", "flexible", "user_choice"]);

export const contextSwitchCostSchema = z.enum(["low", "medium", "high"]);

export const preferredTimeSlotSchema = z.enum([
  "morning",
  "afternoon",
  "evening",
  "night",
  "commute",
  "weekend",
]);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** 長期目標登録フォームの Zod スキーマ。 */
export const goalFormSchema = z.object({
  title: z.string().trim().min(1, "目標名を入力してください").max(200),
  category: goalCategorySchema.default("other"),
  deadline: z
    .string()
    .regex(DATE_REGEX, "日付形式は YYYY-MM-DD")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00`);
      return !Number.isNaN(date.getTime());
    }, "有効な日付を入力してください"),
  currentStatus: z.string().trim().max(2000).optional(),
  targetCondition: z
    .string()
    .trim()
    .min(1, "達成条件を入力してください")
    .max(500),
  priority: goalPrioritySchema.default("medium"),
  weeklyAvailableMinutes: z
    .number()
    .int()
    .min(30, "週30分以上")
    .max(10080, "週168時間以内"),
  avoidTimeSlots: z.array(preferredTimeSlotSchema).max(10).default([]),
});

export const goalUpdateSchema = goalFormSchema.partial().extend({
  status: goalStatusSchema.optional(),
});

export type GoalFormInput = z.input<typeof goalFormSchema>;
export type GoalFormOutput = z.output<typeof goalFormSchema>;
