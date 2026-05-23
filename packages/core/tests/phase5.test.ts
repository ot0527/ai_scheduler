import { describe, expect, it } from "vitest";
import {
  maskAlertMessage,
  parseNotificationSettings,
} from "../src/schemas/notification-settings.js";
import { chatOutputSchema, chatRequestSchema } from "../src/ai/schemas/chat.js";
import { normalizeChatOutput } from "../src/ai/normalize-chat.js";

describe("notification settings", () => {
  it("defaults when invalid JSONB", () => {
    expect(parseNotificationSettings(null)).toEqual({
      showDetailedAlerts: false,
      enablePushNotifications: false,
    });
  });

  it("masks alert message when privacy enabled", () => {
    expect(maskAlertMessage("英検の勉強が遅れています", false)).toContain(
      "確認事項",
    );
    expect(maskAlertMessage("英検の勉強が遅れています", true)).toBe(
      "英検の勉強が遅れています",
    );
  });
});

describe("chat schemas", () => {
  it("validates chat output", () => {
    const result = chatOutputSchema.safeParse({
      reply: "週次予算を見直すことをおすすめします。",
      suggestedActions: [{ label: "時間予算を確認" }],
    });
    expect(result.success).toBe(true);
  });

  it("strips unknown fields in suggestedActions", () => {
    const normalized = normalizeChatOutput({
      reply: "ok",
      suggestedActions: [
        { label: "時間予算を確認", payload: { path: "/budget" } },
      ],
    });
    const result = chatOutputSchema.safeParse(normalized);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggestedActions?.[0]).toEqual({
        label: "時間予算を確認",
      });
    }
  });

  it("rejects unknown top-level fields", () => {
    const result = chatOutputSchema.safeParse({
      reply: "ok",
      extra: "bad",
    });
    expect(result.success).toBe(false);
  });

  it("validates chat request", () => {
    const result = chatRequestSchema.safeParse({
      message: "今日の予定について相談したい",
      history: [{ role: "user", content: "前の質問" }],
    });
    expect(result.success).toBe(true);
  });
});
