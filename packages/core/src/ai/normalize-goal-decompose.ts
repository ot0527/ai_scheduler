import type { GoalDecomposeOutput } from "./schemas/goal-decompose.js";
import { goalDecomposeOutputSchema } from "./schemas/goal-decompose.js";

type JsonRecord = Record<string, unknown>;

const FEASIBILITY = new Set(["possible", "challenging", "unlikely"]);
const PRIORITY = new Set(["high", "medium", "low"]);
const PHASE = new Set(["early", "middle", "late"]);
const ENERGY = new Set(["low", "medium", "high"]);
const PREFERRED_TIME = new Set([
  "morning",
  "afternoon",
  "evening",
  "night",
  "commute",
  "weekend",
]);

/** AI が返しがちな preferredTime 別名 → 正規値 */
const PREFERRED_TIME_ALIASES: Record<string, (typeof PREFERRED_TIME extends Set<infer T> ? T : never)> = {
  early_morning: "morning",
  dawn: "morning",
  noon: "afternoon",
  midday: "afternoon",
  daytime: "afternoon",
  dusk: "evening",
  late_night: "night",
  latenight: "night",
  bedtime: "night",
  weekday: "commute",
  weekdays: "commute",
  workday: "commute",
  saturday: "weekend",
  sunday: "weekend",
  holidays: "weekend",
};

/**
 * preferredTime 配列を正規化する。別名変換・無効値除去・重複除去。
 */
function normalizePreferredTimeSlots(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;

    const normalized = item.trim().toLowerCase().replace(/-/g, "_");
    const mapped =
      PREFERRED_TIME_ALIASES[normalized] ??
      (PREFERRED_TIME.has(normalized) ? normalized : null);

    if (mapped && !result.includes(mapped)) {
      result.push(mapped);
    }
  }

  return result;
}

/**
 * snake_case キーを camelCase に変換する。
 */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

/**
 * オブジェクトのキーを camelCase に正規化する（1 階層のみ）。
 */
function normalizeKeys(obj: JsonRecord): JsonRecord {
  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

/**
 * 数値に変換する。失敗時は undefined。
 */
function toInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

/**
 * 列挙値を検証し、不正なら fallback を返す。
 */
function pickEnum<T extends string>(
  value: unknown,
  allowed: Set<T>,
  fallback: T,
): T {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : fallback;
}

/**
 * AI が返しがちな別名フィールドを正規化した components 行へ変換する。
 */
function normalizeComponent(raw: unknown, index: number): JsonRecord {
  const item = normalizeKeys(
    typeof raw === "object" && raw !== null ? (raw as JsonRecord) : {},
  );

  return {
    name: String(item.name ?? item.title ?? `要素${index + 1}`).trim(),
    estimatedMinutes:
      toInt(item.estimatedMinutes) ??
      toInt(item.estimated_minutes) ??
      toInt(item.totalMinutes) ??
      600,
    priority: pickEnum(item.priority, PRIORITY, "medium"),
    phase: pickEnum(item.phase, PHASE, index === 0 ? "early" : "middle"),
    ...(toInt(item.recommendedSessionsPerWeek) !== undefined
      ? { recommendedSessionsPerWeek: toInt(item.recommendedSessionsPerWeek) }
      : {}),
  };
}

/**
 * AI が返しがちな別名フィールドを正規化した workBlocks 行へ変換する。
 */
function normalizeWorkBlock(
  raw: unknown,
  componentNames: string[],
  index: number,
): JsonRecord {
  const item = normalizeKeys(
    typeof raw === "object" && raw !== null ? (raw as JsonRecord) : {},
  );

  const title = String(item.title ?? item.name ?? `作業${index + 1}`).trim();
  const component = String(
    item.component ?? item.componentName ?? componentNames[0] ?? title,
  ).trim();

  const minMinutes = toInt(item.minMinutes) ?? 10;
  let idealMinutes = toInt(item.idealMinutes) ?? 30;
  let maxMinutes = toInt(item.maxMinutes) ?? Math.max(idealMinutes, 45);

  if (minMinutes > idealMinutes) idealMinutes = minMinutes;
  if (idealMinutes > maxMinutes) maxMinutes = idealMinutes;

  return {
    title,
    component,
    minMinutes,
    idealMinutes,
    maxMinutes,
    energy: pickEnum(item.energy, ENERGY, "medium"),
    isSplittable: item.isSplittable !== false,
    preferredTime: normalizePreferredTimeSlots(
      item.preferredTime ?? item.preferred_time,
    ),
    requiresDeepWork: item.requiresDeepWork === true,
    contextSwitchCost: pickEnum(
      item.contextSwitchCost,
      new Set(["low", "medium", "high"]),
      "medium",
    ),
    orderType: pickEnum(
      item.orderType,
      new Set(["fixed", "flexible", "user_choice"]),
      "flexible",
    ),
  };
}

/**
 * AI 出力 JSON をアプリの Zod スキーマ向けに正規化する。
 * 別名フィールド・欠落値・snake_case を吸収し、未知キーは除去する。
 *
 * @param raw - AI の生 JSON
 * @param fallbackTitle - goal.title が欠落した場合のフォールバック
 */
export function normalizeGoalDecomposeOutput(
  raw: unknown,
  fallbackTitle: string,
): unknown {
  if (typeof raw !== "object" || raw === null) {
    return raw;
  }

  const input = raw as JsonRecord;
  const goalRaw = normalizeKeys(
    typeof input.goal === "object" && input.goal !== null
      ? (input.goal as JsonRecord)
      : {},
  );

  const componentsRaw = Array.isArray(input.components) ? input.components : [];
  const components = componentsRaw.map(normalizeComponent);

  const componentNames = components.map((c) => String(c.name));

  const workBlocksRaw = Array.isArray(input.workBlocks)
    ? input.workBlocks
    : Array.isArray(input.work_blocks)
      ? input.work_blocks
      : [];
  const workBlocks = workBlocksRaw.map((block, index) =>
    normalizeWorkBlock(block, componentNames, index),
  );

  const componentsTotal = components.reduce(
    (sum, c) => sum + (toInt(c.estimatedMinutes) ?? 0),
    0,
  );

  const goal = {
    title: String(goalRaw.title ?? goalRaw.name ?? fallbackTitle).trim(),
    estimatedTotalMinutes:
      toInt(goalRaw.estimatedTotalMinutes) ??
      toInt(goalRaw.estimated_total_minutes) ??
      (componentsTotal > 0 ? componentsTotal : 600),
    feasibility: pickEnum(goalRaw.feasibility, FEASIBILITY, "possible"),
    summary: String(
      goalRaw.summary ?? goalRaw.description ?? "目標達成には継続的な作業が必要です。",
    ).trim(),
  };

  const questions = Array.isArray(input.questions)
    ? input.questions.filter((q) => typeof q === "string")
    : [];

  return { goal, components, workBlocks, questions };
}

/**
 * AI 出力を正規化して Zod 検証する。
 *
 * @param raw - AI の生 JSON
 * @param fallbackTitle - 目標名のフォールバック
 * @returns 検証済みの分解結果
 */
export function parseGoalDecomposeOutput(
  raw: unknown,
  fallbackTitle: string,
): GoalDecomposeOutput {
  const normalized = normalizeGoalDecomposeOutput(raw, fallbackTitle);
  const result = goalDecomposeOutputSchema.safeParse(normalized);

  if (!result.success) {
    throw new Error(`AI output validation failed: ${result.error.message}`);
  }

  return result.data;
}
