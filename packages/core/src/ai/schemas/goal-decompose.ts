import { z } from "zod";
import {
  contextSwitchCostSchema,
  energyLevelSchema,
  feasibilitySchema,
  goalPhaseSchema,
  goalPrioritySchema,
  orderTypeSchema,
  preferredTimeSlotSchema,
} from "../../schemas/goal.js";
import { AI_LIMITS } from "../constants.js";

const sanitizedString = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((value) => value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""));

const timeMenuSchema = z.object({
  minutes: z.number().int().positive().max(AI_LIMITS.maxBlockMinutes),
  content: sanitizedString(500),
});

const workBlockSchema = z
  .object({
    title: sanitizedString(200),
    component: sanitizedString(200),
    minMinutes: z.number().int().positive().max(AI_LIMITS.maxBlockMinutes),
    idealMinutes: z.number().int().positive().max(AI_LIMITS.maxBlockMinutes),
    maxMinutes: z.number().int().positive().max(AI_LIMITS.maxBlockMinutes),
    energy: energyLevelSchema,
    isSplittable: z.boolean(),
    preferredTime: z.array(preferredTimeSlotSchema).max(10).default([]),
    requiresDeepWork: z.boolean().default(false),
    contextSwitchCost: contextSwitchCostSchema.default("medium"),
    orderType: orderTypeSchema.default("flexible"),
    timeMenus: z.array(timeMenuSchema).max(10).optional(),
  })
  .strict()
  .superRefine((block, ctx) => {
    if (block.minMinutes > block.idealMinutes || block.idealMinutes > block.maxMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minMinutes <= idealMinutes <= maxMinutes である必要があります",
        path: ["minMinutes"],
      });
    }
  });

const componentSchema = z
  .object({
    name: sanitizedString(200),
    estimatedMinutes: z
      .number()
      .int()
      .positive()
      .max(AI_LIMITS.maxComponentMinutes),
    priority: goalPrioritySchema,
    phase: goalPhaseSchema,
    recommendedSessionsPerWeek: z
      .number()
      .int()
      .min(0)
      .max(14)
      .optional(),
  })
  .strict();

/** AI 目標分解の出力 Zod スキーマ（strict + 相互参照検証）。 */
export const goalDecomposeOutputSchema = z
  .object({
    goal: z
      .object({
        title: sanitizedString(200),
        estimatedTotalMinutes: z
          .number()
          .int()
          .positive()
          .max(AI_LIMITS.maxTotalMinutes),
        feasibility: feasibilitySchema,
        summary: sanitizedString(2000),
      })
      .strict(),
    components: z
      .array(componentSchema)
      .min(1)
      .max(AI_LIMITS.maxComponents),
    workBlocks: z
      .array(workBlockSchema)
      .min(1)
      .max(AI_LIMITS.maxWorkBlocks),
    questions: z.array(sanitizedString(500)).max(AI_LIMITS.maxQuestions).default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const componentNames = new Set(
      data.components.map((component) => component.name.toLowerCase()),
    );

    for (const [index, block] of data.workBlocks.entries()) {
      if (!componentNames.has(block.component.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `workBlocks[${index}] の component が components に存在しません`,
          path: ["workBlocks", index, "component"],
        });
      }
    }
  });

/** ユーザー承認時に Edge Function へ送るペイロード。 */
export const goalDecomposeApproveSchema = goalDecomposeOutputSchema;

export type GoalDecomposeOutput = z.infer<typeof goalDecomposeOutputSchema>;
export type GoalDecomposeComponent = z.infer<typeof componentSchema>;
export type GoalDecomposeWorkBlock = z.infer<typeof workBlockSchema>;
