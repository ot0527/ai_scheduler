import { describe, expect, it } from "vitest";
import { validatePlacedBlocks } from "../src/scheduling/validation.js";
import type { PlacedBlock } from "../src/scheduling/placement.js";
import type { FreeTimeResult, TimeString } from "../src/scheduling/types.js";

/** テスト用の FreeTimeResult を生成する。 */
function buildFreeTime(wakeTime: TimeString, sleepTime: TimeString): FreeTimeResult {
  return {
    date: new Date(2026, 6, 19),
    wakeTime,
    sleepTime,
    blockedBlocks: [],
    freeSlots: [],
    lifeRoutines: [],
  };
}

/** テスト用の PlacedBlock を生成する。 */
function buildBlock(startMinutes: number, endMinutes: number): PlacedBlock {
  return {
    workBlockTemplateId: "t1",
    goalId: "g1",
    componentId: "c1",
    title: "テスト作業",
    startMinutes,
    endMinutes,
    plannedMinutes: endMinutes - startMinutes,
    orderType: "flexible",
    score: 0.5,
  };
}

describe("validatePlacedBlocks", () => {
  it("accepts a block within wake-sleep range", () => {
    const freeTime = buildFreeTime("07:00", "23:00");
    const issues = validatePlacedBlocks(freeTime, [buildBlock(9 * 60, 10 * 60)]);
    expect(issues).toHaveLength(0);
  });

  it("rejects a block outside wake-sleep range", () => {
    const freeTime = buildFreeTime("07:00", "23:00");
    const issues = validatePlacedBlocks(freeTime, [buildBlock(23 * 60, 24 * 60)]);
    expect(issues.some((issue) => issue.code === "out_of_bounds")).toBe(true);
  });

  it("accepts a late-night block when sleep time crosses midnight", () => {
    // 起床 07:00・就寝 00:30 → calculateFreeTime は 24:30（1470分）まで有効とみなす
    const freeTime = buildFreeTime("07:00", "00:30");
    const issues = validatePlacedBlocks(freeTime, [
      buildBlock(23 * 60 + 30, 24 * 60 + 30),
    ]);
    expect(issues).toHaveLength(0);
  });

  it("accepts back-to-back blocks (adjacent, not overlapping)", () => {
    // 連続配置（前の終了 = 次の開始）は重複ではない
    const freeTime = buildFreeTime("07:00", "23:00");
    const issues = validatePlacedBlocks(freeTime, [
      buildBlock(7 * 60, 8 * 60),
      buildBlock(8 * 60, 9 * 60),
    ]);
    expect(issues).toHaveLength(0);
  });

  it("detects overlapping placed blocks", () => {
    const freeTime = buildFreeTime("07:00", "23:00");
    const issues = validatePlacedBlocks(freeTime, [
      buildBlock(9 * 60, 10 * 60),
      buildBlock(9 * 60 + 30, 10 * 60 + 30),
    ]);
    expect(issues.some((issue) => issue.code === "overlap")).toBe(true);
  });
});
