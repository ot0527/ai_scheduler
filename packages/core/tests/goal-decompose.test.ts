import { describe, expect, it } from "vitest";
import { normalizeGoalDecomposeOutput } from "../src/ai/normalize-goal-decompose.js";
import { goalDecomposeOutputSchema } from "../src/ai/schemas/goal-decompose.js";

const validFixture = {
  goal: {
    title: "英検2級合格",
    estimatedTotalMinutes: 9000,
    feasibility: "possible" as const,
    summary: "継続的な学習が必要です。",
  },
  components: [
    {
      name: "単語",
      estimatedMinutes: 3000,
      priority: "high" as const,
      phase: "early" as const,
      recommendedSessionsPerWeek: 5,
    },
    {
      name: "読解",
      estimatedMinutes: 6000,
      priority: "medium" as const,
      phase: "middle" as const,
    },
  ],
  workBlocks: [
    {
      title: "単語暗記",
      component: "単語",
      minMinutes: 10,
      idealMinutes: 30,
      maxMinutes: 45,
      energy: "low" as const,
      isSplittable: true,
      preferredTime: ["morning", "night"],
      requiresDeepWork: false,
    },
    {
      title: "長文読解",
      component: "読解",
      minMinutes: 20,
      idealMinutes: 45,
      maxMinutes: 60,
      energy: "high" as const,
      isSplittable: true,
      preferredTime: ["evening"],
      requiresDeepWork: true,
    },
  ],
  questions: [],
};

/** Gemini が返しがちな別スキーマ形式 */
const geminiLikeFixture = {
  goal: {
    title: "英検2級",
    category: "study",
    deadline: "2026-12-31",
    priority: "high",
    summary: "全体サマリー",
  },
  components: [
    { name: "単語", summary: "単語学習" },
    { name: "読解", summary: "読解練習" },
    { name: "リスニング", summary: "聴解練習" },
  ],
  workBlocks: [
    { name: "単語帳", summary: "暗記", component: "単語" },
    { name: "長文", summary: "読解", component: "読解" },
  ],
  questions: [],
};

describe("goalDecomposeOutputSchema", () => {
  it("有効な AI 出力を受け入れる", () => {
    const result = goalDecomposeOutputSchema.safeParse(validFixture);
    expect(result.success).toBe(true);
  });

  it("min > ideal のブロックを拒否する", () => {
    const result = goalDecomposeOutputSchema.safeParse({
      ...validFixture,
      workBlocks: [
        {
          ...validFixture.workBlocks[0],
          minMinutes: 60,
          idealMinutes: 30,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("存在しない component 参照を拒否する", () => {
    const result = goalDecomposeOutputSchema.safeParse({
      ...validFixture,
      workBlocks: [
        {
          ...validFixture.workBlocks[0],
          component: "存在しないカテゴリ",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("未知フィールドを拒否する", () => {
    const result = goalDecomposeOutputSchema.safeParse({
      ...validFixture,
      extraField: "hack",
    });
    expect(result.success).toBe(false);
  });

  it("配列上限を超える components を拒否する", () => {
    const result = goalDecomposeOutputSchema.safeParse({
      ...validFixture,
      components: Array.from({ length: 51 }, (_, index) => ({
        name: `要素${index}`,
        estimatedMinutes: 60,
        priority: "medium" as const,
        phase: "early" as const,
      })),
      workBlocks: validFixture.workBlocks,
    });
    expect(result.success).toBe(false);
  });
});

describe("normalizeGoalDecomposeOutput", () => {
  it("Gemini 風の別名フィールドを正規化して検証を通す", () => {
    const normalized = normalizeGoalDecomposeOutput(
      geminiLikeFixture,
      "英検2級合格",
    );
    const result = goalDecomposeOutputSchema.safeParse(normalized);
    expect(result.success).toBe(true);
  });

  it("late_night を night に正規化する", () => {
    const normalized = normalizeGoalDecomposeOutput(
      {
        goal: { title: "テスト", summary: "概要" },
        components: [{ name: "学習" }],
        workBlocks: [
          {
            name: "復習",
            component: "学習",
            preferredTime: ["morning", "late_night"],
          },
        ],
        questions: [],
      },
      "テスト",
    );
    const result = goalDecomposeOutputSchema.safeParse(normalized);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workBlocks[0].preferredTime).toEqual(["morning", "night"]);
    }
  });
});
