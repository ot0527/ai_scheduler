import { describe, expect, it } from "vitest";
import {
  deltaCompletedMinutes,
  isScheduleFullyRecorded,
  needsReschedule,
  remainingMinutesFromBlock,
  resolveActualMinutes,
} from "../src/scheduling/execution.js";
import {
  adaptTemplateForReschedule,
  buildRescheduleSearchDates,
  findBestSlotForBlock,
} from "../src/scheduling/reschedule-minor.js";
import { calculateFreeTime } from "../src/scheduling/free-time.js";
import type { TimeString } from "../src/scheduling/types.js";

describe("resolveActualMinutes", () => {
  it("returns planned minutes for done status", () => {
    expect(resolveActualMinutes("done", 30)).toBe(30);
  });

  it("returns zero for skipped status", () => {
    expect(resolveActualMinutes("skipped", 30)).toBe(0);
  });

  it("caps partial minutes to planned", () => {
    expect(resolveActualMinutes("partial", 30, 45)).toBe(30);
    expect(resolveActualMinutes("partial", 30, 15)).toBe(15);
  });
});

describe("needsReschedule", () => {
  it("detects skipped and partial blocks needing reschedule", () => {
    expect(needsReschedule("skipped", 30, 0)).toBe(true);
    expect(needsReschedule("partial", 30, 10)).toBe(true);
    expect(needsReschedule("done", 30, 30)).toBe(false);
    expect(needsReschedule("rescheduled", 30, 0)).toBe(false);
  });
});

describe("isScheduleFullyRecorded", () => {
  it("returns true when no planned blocks remain", () => {
    expect(isScheduleFullyRecorded(["done", "skipped"])).toBe(true);
    expect(isScheduleFullyRecorded(["done", "planned"])).toBe(false);
    expect(isScheduleFullyRecorded([])).toBe(false);
  });
});

describe("deltaCompletedMinutes", () => {
  it("returns difference between new and previous actual minutes", () => {
    expect(deltaCompletedMinutes(0, 20)).toBe(20);
    expect(deltaCompletedMinutes(20, 30)).toBe(10);
    expect(deltaCompletedMinutes(30, 10)).toBe(-20);
  });
});

describe("remainingMinutesFromBlock", () => {
  it("returns uncompleted portion", () => {
    expect(remainingMinutesFromBlock(30, 10)).toBe(20);
    expect(remainingMinutesFromBlock(30, 30)).toBe(0);
  });
});

describe("buildRescheduleSearchDates", () => {
  it("returns consecutive date keys from start", () => {
    const dates = buildRescheduleSearchDates("2026-05-25", 3);
    expect(dates).toEqual(["2026-05-25", "2026-05-26", "2026-05-27"]);
  });
});

describe("findBestSlotForBlock", () => {
  it("finds a slot for reschedule template", () => {
    const freeTime = calculateFreeTime({
      date: new Date("2026-05-26T12:00:00"),
      preferences: {
        wakeTime: "07:00" as TimeString,
        sleepTime: "23:00" as TimeString,
      },
      lifeRoutines: [],
      fixedSchedules: [],
      dayOverrides: [],
    });

    const template = adaptTemplateForReschedule(
      {
        id: "t1",
        goalId: "g1",
        componentId: "c1",
        title: "復習",
        minMinutes: 20,
        idealMinutes: 30,
        maxMinutes: 45,
        energy: "low",
        preferredTime: [],
        requiresDeepWork: false,
        orderType: "flexible",
      },
      25,
    );

    const slot = findBestSlotForBlock(freeTime, template);
    expect(slot).not.toBeNull();
    expect(slot!.plannedMinutes).toBeGreaterThanOrEqual(20);
  });
});
