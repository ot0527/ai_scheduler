import { describe, expect, it } from "vitest";
import {
  allocateWeeklyBudgets,
  calculateWeeklyRequired,
} from "../src/scheduling/budget.js";
import { generateDailyPlacement } from "../src/scheduling/placement.js";
import { calculateFreeTime } from "../src/scheduling/free-time.js";
import type { TimeString } from "../src/scheduling/types.js";

describe("calculateWeeklyRequired", () => {
  it("calculates required minutes from remaining work and weeks", () => {
    const result = calculateWeeklyRequired({
      goalId: "g1",
      title: "英検2級",
      deadline: "2026-11-22",
      priority: "high",
      estimatedTotalMinutes: 6000,
      completedMinutes: 0,
      weeklyAvailableMinutes: 360,
      todayKey: "2026-05-22",
    });

    expect(result.requiredMinutes).toBeGreaterThan(0);
    expect(result.remainingMinutes).toBe(6000);
  });
});

describe("allocateWeeklyBudgets", () => {
  it("allocates proportionally when total required exceeds available time", () => {
    const requirements = [
      {
        goalId: "g1",
        title: "目標A",
        priority: "high" as const,
        requiredMinutes: 360,
        weeksRemaining: 10,
        remainingMinutes: 3600,
        weeklyAvailableMinutes: 240,
      },
      {
        goalId: "g2",
        title: "目標B",
        priority: "low" as const,
        requiredMinutes: 240,
        weeksRemaining: 10,
        remainingMinutes: 2400,
        weeklyAvailableMinutes: 120,
      },
    ];

    const result = allocateWeeklyBudgets(requirements, 300);
    expect(result.budgets).toHaveLength(2);
    expect(result.shortageMinutes).toBeGreaterThan(0);
    expect(
      result.budgets.reduce((sum, budget) => sum + budget.allocatedMinutes, 0),
    ).toBeLessThanOrEqual(300);
  });
});

describe("generateDailyPlacement", () => {
  it("places blocks into free slots without fixed schedule conflicts", () => {
    const date = new Date("2026-05-22T12:00:00");
    const freeTime = calculateFreeTime({
      date,
      preferences: {
        wakeTime: "07:00" as TimeString,
        sleepTime: "23:00" as TimeString,
      },
      lifeRoutines: [],
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

    const result = generateDailyPlacement(
      freeTime,
      [
        {
          id: "block1",
          goalId: "g1",
          componentId: "c1",
          title: "短時間作業",
          minMinutes: 20,
          idealMinutes: 30,
          maxMinutes: 45,
          energy: "low",
          preferredTime: ["morning", "night"],
          requiresDeepWork: false,
          orderType: "flexible",
        },
      ],
      [
        {
          goalId: "g1",
          goalTitle: "目標A",
          allocatedMinutes: 360,
          completedMinutesThisWeek: 0,
          deadline: "2026-12-31",
          priority: "high",
        },
      ],
      ["07:00"],
      "2026-05-22",
    );

    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      expect(block.startMinutes).toBeLessThan(9 * 60);
    }
  });
});
