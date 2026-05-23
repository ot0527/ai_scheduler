import { resolveRoutineLabel } from "./constants.js";
import type {
  LifeRoutineInput,
  ResolvedLifeRoutine,
  RoutineDayOverrideInput,
  UserDayPreferences,
} from "./types.js";

/**
 * 指定種別・IDの当日変更を検索する。
 */
export function findDayOverride(
  overrides: RoutineDayOverrideInput[],
  targetType: "wake" | "sleep" | "routine",
  lifeRoutineId?: string,
): RoutineDayOverrideInput | undefined {
  return overrides.find((override) => {
    if (targetType === "routine") {
      return (
        override.targetType === "routine" &&
        override.lifeRoutineId === lifeRoutineId
      );
    }
    return override.targetType === targetType;
  });
}

/**
 * 当日変更を反映した起床・就寝時刻を解決する。
 * skip 指定時は就寝・起床の skip は現 Phase では未対応のため、modify のみ反映する。
 */
export function resolveWakeSleepTimes(
  base: UserDayPreferences,
  overrides: RoutineDayOverrideInput[],
): UserDayPreferences {
  const wakeOverride = findDayOverride(overrides, "wake");
  const sleepOverride = findDayOverride(overrides, "sleep");

  return {
    wakeTime:
      wakeOverride?.action === "modify" && wakeOverride.preferredTime
        ? wakeOverride.preferredTime
        : base.wakeTime,
    sleepTime:
      sleepOverride?.action === "modify" && sleepOverride.preferredTime
        ? sleepOverride.preferredTime
        : base.sleepTime,
  };
}

/**
 * 当日変更を反映した生活リズムを解決する。
 */
export function resolveLifeRoutineForDay(
  routine: LifeRoutineInput,
  overrides: RoutineDayOverrideInput[],
): ResolvedLifeRoutine {
  const override = findDayOverride(overrides, "routine", routine.id);
  const label = resolveRoutineLabel(routine.type, routine.label);

  if (override?.action === "skip") {
    return {
      id: routine.id,
      type: routine.type,
      label,
      preferredTime: routine.preferredTime,
      earliestTime: routine.earliestTime,
      latestTime: routine.latestTime,
      durationMinutes: routine.durationMinutes,
      skipped: true,
    };
  }

  if (override?.action === "modify") {
    return {
      id: routine.id,
      type: routine.type,
      label,
      preferredTime: override.preferredTime ?? routine.preferredTime,
      earliestTime: override.earliestTime ?? routine.earliestTime,
      latestTime: override.latestTime ?? routine.latestTime,
      durationMinutes: override.durationMinutes ?? routine.durationMinutes,
      skipped: false,
    };
  }

  return {
    id: routine.id,
    type: routine.type,
    label,
    preferredTime: routine.preferredTime,
    earliestTime: routine.earliestTime,
    latestTime: routine.latestTime,
    durationMinutes: routine.durationMinutes,
    skipped: false,
  };
}
