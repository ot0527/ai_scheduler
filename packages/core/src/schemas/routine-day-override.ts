import { z } from "zod";
import { convertApproxTime } from "../scheduling/time-utils.js";
import { TIME_REGEX } from "./common.js";

/** 当日変更フォームの Zod スキーマ（起床/就寝/生活リズム）。 */
export const routineDayOverrideFormSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("wake"),
    action: z.enum(["skip", "modify"]),
    preferredTime: z.string().regex(TIME_REGEX).optional(),
  }),
  z.object({
    targetType: z.literal("sleep"),
    action: z.enum(["skip", "modify"]),
    preferredTime: z.string().regex(TIME_REGEX).optional(),
  }),
  z.object({
    targetType: z.literal("routine"),
    lifeRoutineId: z.string().uuid(),
    action: z.enum(["skip", "modify"]),
    preferredTime: z.string().regex(TIME_REGEX).optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    flexibilityMinutes: z.number().int().min(0).max(120).default(30),
  }),
]);

export type RoutineDayOverrideFormInput = z.input<
  typeof routineDayOverrideFormSchema
>;

/**
 * フォーム入力を Supabase upsert 用ペイロードに変換する。
 * UI 層と DB 層の橋渡しを一箇所に集約する。
 */
export function buildOverridePayload(
  input: RoutineDayOverrideFormInput,
  targetDate: string,
) {
  const base = { target_date: targetDate };

  if (input.targetType === "wake" || input.targetType === "sleep") {
    if (input.action === "skip") {
      return {
        ...base,
        target_type: input.targetType,
        action: "skip" as const,
        preferred_time: null,
        earliest_time: null,
        latest_time: null,
        duration_minutes: null,
        life_routine_id: null,
      };
    }
    const time = input.preferredTime!;
    const range = convertApproxTime(time);
    return {
      ...base,
      target_type: input.targetType,
      action: "modify" as const,
      preferred_time: range.preferredTime,
      earliest_time: range.earliestTime,
      latest_time: range.latestTime,
      duration_minutes: null,
      life_routine_id: null,
    };
  }

  if (input.action === "skip") {
    return {
      ...base,
      target_type: "routine" as const,
      action: "skip" as const,
      life_routine_id: input.lifeRoutineId,
      preferred_time: null,
      earliest_time: null,
      latest_time: null,
      duration_minutes: null,
    };
  }

  const time = input.preferredTime!;
  const range = convertApproxTime(time, input.flexibilityMinutes ?? 30);
  return {
    ...base,
    target_type: "routine" as const,
    action: "modify" as const,
    life_routine_id: input.lifeRoutineId,
    preferred_time: range.preferredTime,
    earliest_time: range.earliestTime,
    latest_time: range.latestTime,
    duration_minutes: input.durationMinutes ?? null,
  };
}
