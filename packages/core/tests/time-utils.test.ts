import { describe, expect, it } from "vitest";
import { convertApproxTime, parseTimeToMinutes } from "../src/scheduling/time-utils.js";

describe("convertApproxTime", () => {
  it("converts preferred time to ±30 min window by default", () => {
    const result = convertApproxTime("20:00");
    expect(result.preferredTime).toBe("20:00");
    expect(result.earliestTime).toBe("19:30");
    expect(result.latestTime).toBe("20:30");
  });

  it("supports custom flexibility window", () => {
    const result = convertApproxTime("22:30", 15);
    expect(result.earliestTime).toBe("22:15");
    expect(result.latestTime).toBe("22:45");
  });
});

describe("parseTimeToMinutes", () => {
  it("parses standard time", () => {
    expect(parseTimeToMinutes("09:00")).toBe(540);
    expect(parseTimeToMinutes("20:30")).toBe(1230);
  });

  it("supports late night hours", () => {
    expect(parseTimeToMinutes("24:00")).toBe(1440);
    expect(parseTimeToMinutes("25:00")).toBe(1500);
  });
});
