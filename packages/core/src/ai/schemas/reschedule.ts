import { z } from "zod";
import { AI_LIMITS } from "../constants.js";

const sanitizedString = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((value) => value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""));

/** 大規模リスケ AI 出力の予算更新案 */
const updatedBudgetSchema = z
  .object({
    goalId: sanitizedString(100),
    weeklyTargetMinutes: z.number().int().min(0).max(AI_LIMITS.maxBlockMinutes * 7),
  })
  .strict();

/** 大規模リスケ AI 出力 Zod スキーマ */
export const majorRescheduleOutputSchema = z
  .object({
    status: z.enum(["needs_adjustment", "on_track"]),
    summary: sanitizedString(500),
    updatedBudgets: z.array(updatedBudgetSchema).max(20),
    recommendations: z.array(sanitizedString(300)).max(10),
    requiresUserApproval: z.boolean(),
  })
  .strict();

export type MajorRescheduleOutput = z.infer<typeof majorRescheduleOutputSchema>;
