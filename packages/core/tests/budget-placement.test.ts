import { describe, expect, it } from "vitest";
import {
  allocateWeeklyBudgets,
  calculateWeeklyRequired,
} from "../src/scheduling/budget.js";
import { generateDailyPlacement } from "../src/scheduling/placement.js";
import { calculateFreeTime } from "../src/scheduling/free-time.js";
import { isValidPlacement } from "../src/scheduling/validation.js";
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

  it("distributes remainder minutes so the total equals available time", () => {
    // 重み 3:2:1 で 100 分を按分 → floor だと 50+33+16=99 分になり 1 分余る
    const requirements = ["high", "medium", "low"].map((priority, index) => ({
      goalId: `g${index}`,
      title: `目標${index}`,
      priority: priority as "high" | "medium" | "low",
      requiredMinutes: 100,
      weeksRemaining: 10,
      remainingMinutes: 1000,
      weeklyAvailableMinutes: 100,
    }));

    const result = allocateWeeklyBudgets(requirements, 100);
    expect(
      result.budgets.reduce((sum, budget) => sum + budget.allocatedMinutes, 0),
    ).toBe(100);
  });

  it("uses up available time even when some goals hit their required cap", () => {
    // 同一重みで requiredMinutes=[1,1,1,100]・利用可能 6 分。
    // 1 周 1 分の再配分では [1,1,1,2]=5 分となり 1 分残る回帰ケース
    const requirements = [1, 1, 1, 100].map((required, index) => ({
      goalId: `g${index}`,
      title: `目標${index}`,
      priority: "high" as const,
      requiredMinutes: required,
      weeksRemaining: 10,
      remainingMinutes: required * 10,
      weeklyAvailableMinutes: 100,
    }));

    const result = allocateWeeklyBudgets(requirements, 6);
    expect(
      result.budgets.reduce((sum, budget) => sum + budget.allocatedMinutes, 0),
    ).toBe(6);
    // 各目標は必要時間を超えて割り当てられない
    for (const budget of result.budgets) {
      expect(budget.allocatedMinutes).toBeLessThanOrEqual(budget.requiredMinutes);
    }
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

  it("packs multiple blocks into a single long free slot", () => {
    const date = new Date("2026-05-23T12:00:00"); // 土曜(固定予定なし)
    const freeTime = calculateFreeTime({
      date,
      preferences: {
        wakeTime: "07:00" as TimeString,
        sleepTime: "23:00" as TimeString,
      },
      lifeRoutines: [],
      fixedSchedules: [],
      dayOverrides: [],
    });

    const template = (id: string) => ({
      id,
      goalId: "g1",
      componentId: "c1",
      title: `作業${id}`,
      minMinutes: 30,
      idealMinutes: 60,
      maxMinutes: 60,
      energy: "low" as const,
      preferredTime: [],
      requiresDeepWork: false,
      orderType: "flexible" as const,
    });

    const result = generateDailyPlacement(
      freeTime,
      [template("t1"), template("t2")],
      [
        {
          goalId: "g1",
          goalTitle: "目標A",
          allocatedMinutes: 600,
          completedMinutesThisWeek: 0,
          deadline: "2026-12-31",
          priority: "high",
        },
      ],
      [],
      "2026-05-23",
    );

    // 空きスロットは1つ(07:00-23:00)だが、2ブロックとも配置される
    expect(result.blocks).toHaveLength(2);
    const [first, second] = [...result.blocks].sort(
      (a, b) => a.startMinutes - b.startMinutes,
    );
    expect(first!.endMinutes).toBeLessThanOrEqual(second!.startMinutes);

    // 生成結果はバリデーションを通過する（連続配置が重複扱いされない）
    expect(isValidPlacement(freeTime, result.blocks)).toBe(true);
  });

  it("blocks out cross-midnight fixed schedules", () => {
    const date = new Date("2026-05-22T12:00:00");
    const freeTime = calculateFreeTime({
      date,
      preferences: {
        wakeTime: "09:00" as TimeString,
        sleepTime: "08:00" as TimeString, // 日跨ぎ就寝(翌 08:00)
      },
      lifeRoutines: [],
      fixedSchedules: [
        {
          id: "night-shift",
          title: "夜勤",
          startTime: "22:00" as TimeString,
          endTime: "06:00" as TimeString, // 日跨ぎ勤務
          daysOfWeek: [1, 2, 3, 4, 5],
          commuteMinutes: 0,
        },
      ],
      dayOverrides: [],
    });

    // 22:00〜翌06:00 がブロックされ、空きは 09:00-22:00 と 翌06:00-08:00
    // （前日木曜の夜勤の早朝部分 [-120, 360] も含まれるため当日分を探す）
    const nightBlocks = freeTime.blockedBlocks.filter((b) => b.label === "夜勤");
    expect(nightBlocks.some((b) => b.endMinutes === 30 * 60)).toBe(true); // 翌 06:00 = 1800 分
    expect(
      freeTime.freeSlots.every(
        (slot) => slot.endMinutes <= 22 * 60 || slot.startMinutes >= 30 * 60,
      ),
    ).toBe(true);
  });

  it("excludes the morning tail of the previous day's overnight shift", () => {
    // 金曜 22:00〜土曜 06:00 の夜勤。土曜（早起き）を計算すると
    // 早朝 05:00-06:00 は前日夜勤の続きとして除外されるべき
    const saturday = new Date("2026-05-23T12:00:00");
    const freeTime = calculateFreeTime({
      date: saturday,
      preferences: {
        wakeTime: "04:00" as TimeString,
        sleepTime: "22:00" as TimeString,
      },
      lifeRoutines: [],
      fixedSchedules: [
        {
          id: "night-shift",
          title: "夜勤",
          startTime: "22:00" as TimeString,
          endTime: "06:00" as TimeString,
          daysOfWeek: [5], // 金曜開始
          commuteMinutes: 0,
        },
      ],
      dayOverrides: [],
    });

    // 04:00-06:00 は夜勤の続きなので空き時間に含まれない
    expect(
      freeTime.freeSlots.every((slot) => slot.startMinutes >= 6 * 60),
    ).toBe(true);
  });

  it("excludes next-day early fixed schedules within a cross-midnight window", () => {
    // 金曜: 起床 09:00・就寝 翌 08:00。土曜早朝 06:00-07:00 の予定は
    // 金曜の枠（翌日側 1800-1860 分）としてブロックされるべき
    const friday = new Date("2026-05-22T12:00:00");
    const freeTime = calculateFreeTime({
      date: friday,
      preferences: {
        wakeTime: "09:00" as TimeString,
        sleepTime: "08:00" as TimeString, // 日跨ぎ就寝
      },
      lifeRoutines: [],
      fixedSchedules: [
        {
          id: "sat-morning",
          title: "早朝ラン",
          startTime: "06:00" as TimeString,
          endTime: "07:00" as TimeString,
          daysOfWeek: [6], // 土曜
          commuteMinutes: 0,
        },
      ],
      dayOverrides: [],
    });

    // 翌 06:00-07:00（1800-1860 分）は空き時間に含まれない
    expect(
      freeTime.freeSlots.every(
        (slot) => slot.endMinutes <= 30 * 60 || slot.startMinutes >= 31 * 60,
      ),
    ).toBe(true);
  });
});
