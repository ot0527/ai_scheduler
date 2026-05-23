import { describe, expect, it } from "vitest";
import { calculateFreeTime } from "../src/scheduling/free-time.js";
import type { TimeString } from "../src/scheduling/types.js";

describe("calculateFreeTime", () => {
  const baseDate = new Date("2026-05-22T12:00:00"); // 木曜日

  it("calculates free slots excluding fixed schedules and routines", () => {
    const result = calculateFreeTime({
      date: baseDate,
      preferences: {
        wakeTime: "07:00" as TimeString,
        sleepTime: "23:00" as TimeString,
      },
      lifeRoutines: [
        {
          id: "dinner",
          type: "dinner",
          label: null,
          preferredTime: "20:00" as TimeString,
          earliestTime: "19:30" as TimeString,
          latestTime: "21:00" as TimeString,
          durationMinutes: 30,
          appliesTo: "both",
        },
      ],
      fixedSchedules: [
        {
          id: "work",
          title: "仕事",
          startTime: "09:00" as TimeString,
          endTime: "18:00" as TimeString,
          daysOfWeek: [1, 2, 3, 4, 5],
          commuteMinutes: 0,
        },
      ],
      dayOverrides: [],
    });

    expect(result.freeSlots.length).toBeGreaterThan(0);
    expect(result.blockedBlocks.some((b) => b.label === "仕事")).toBe(true);
    expect(result.lifeRoutines.find((r) => r.type === "dinner")?.skipped).toBe(
      false,
    );

    const hasMorningSlot = result.freeSlots.some(
      (s) => s.startMinutes >= 7 * 60 && s.endMinutes <= 9 * 60,
    );
    expect(hasMorningSlot).toBe(true);
  });

  it("applies daily override for routine skip", () => {
    const result = calculateFreeTime({
      date: baseDate,
      preferences: {
        wakeTime: "07:00" as TimeString,
        sleepTime: "23:00" as TimeString,
      },
      lifeRoutines: [
        {
          id: "bath",
          type: "bath",
          label: null,
          preferredTime: "22:00" as TimeString,
          earliestTime: "21:30" as TimeString,
          latestTime: "22:30" as TimeString,
          durationMinutes: 30,
          appliesTo: "both",
        },
      ],
      fixedSchedules: [],
      dayOverrides: [
        {
          targetType: "routine",
          lifeRoutineId: "bath",
          action: "skip",
          preferredTime: null,
          earliestTime: null,
          latestTime: null,
          durationMinutes: null,
        },
      ],
    });

    expect(result.lifeRoutines[0]?.skipped).toBe(true);
    expect(result.blockedBlocks.filter((b) => b.kind === "routine")).toHaveLength(
      0,
    );
  });

  it("applies wake/sleep daily override", () => {
    const result = calculateFreeTime({
      date: baseDate,
      preferences: {
        wakeTime: "07:00" as TimeString,
        sleepTime: "23:00" as TimeString,
      },
      lifeRoutines: [],
      fixedSchedules: [],
      dayOverrides: [
        {
          targetType: "sleep",
          lifeRoutineId: null,
          action: "modify",
          preferredTime: "24:30" as TimeString,
          earliestTime: null,
          latestTime: null,
          durationMinutes: null,
        },
      ],
    });

    expect(result.sleepTime).toBe("24:30");
  });
});
