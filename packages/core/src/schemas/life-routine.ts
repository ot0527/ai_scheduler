import { z } from "zod";
import { ROUTINE_TYPE_LABELS } from "../scheduling/constants.js";
import { convertApproxTime } from "../scheduling/time-utils.js";
import { TIME_REGEX } from "./common.js";

export const routineTypeSchema = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "bath",
  "break",
  "other",
]);

export const appliesToSchema = z.enum(["weekday", "weekend", "both"]);

export const flexibilitySchema = z.enum(["fixed", "flexible"]);

/** 生活リズム登録フォームの Zod スキーマ。「ごろ」→ 許容幅の変換を含む。 */
export const lifeRoutineFormSchema = z
  .object({
    type: routineTypeSchema,
    label: z.string().max(100).optional(),
    preferredTime: z.string().regex(TIME_REGEX, "時刻形式は HH:mm"),
    durationMinutes: z.number().int().min(5).max(480),
    flexibilityMinutes: z.number().int().min(0).max(120).default(30),
    flexibility: flexibilitySchema.default("flexible"),
    appliesTo: appliesToSchema.default("both"),
    sortOrder: z.number().int().default(0),
  })
  .transform((data) => {
    const range = convertApproxTime(data.preferredTime, data.flexibilityMinutes);
    return {
      ...data,
      earliestTime: range.earliestTime,
      latestTime: range.latestTime,
      preferredTime: range.preferredTime,
    };
  });

export const lifeRoutineUpdateSchema = lifeRoutineFormSchema;

export type LifeRoutineFormInput = z.input<typeof lifeRoutineFormSchema>;
export type LifeRoutineFormOutput = z.output<typeof lifeRoutineFormSchema>;
