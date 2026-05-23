import { MINUTES_PER_DAY } from "./constants.js";
import type { TimeString } from "./types.js";

/**
 * 時刻文字列を「0時からの経過分」に変換する。
 * 24時以降（例: 25:00）もサポートする。
 *
 * @param time "HH:mm" または "HH:mm:ss" 形式
 */
export function parseTimeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  const [hours = 0, minutes = 0] = parts;
  return hours * 60 + minutes;
}

/**
 * 経過分を "HH:mm" 形式の時刻文字列に変換する。
 * 1440 以上の値は 24 時間周期で正規化する。
 */
export function formatMinutesToTime(minutes: number): TimeString {
  const normalized =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as TimeString;
}

/** 時刻に指定分を加算する。 */
export function addMinutesToTime(time: string, delta: number): TimeString {
  return formatMinutesToTime(parseTimeToMinutes(time) + delta);
}

/** 時刻から指定分を減算する。 */
export function subtractMinutesFromTime(time: string, delta: number): TimeString {
  return formatMinutesToTime(parseTimeToMinutes(time) - delta);
}

/** 「ごろ」入力から preferred / earliest / latest を算出した結果。 */
export interface ApproxTimeRange {
  preferredTime: TimeString;
  earliestTime: TimeString;
  latestTime: TimeString;
}

/**
 * 「ごろ」入力を内部表現（希望時刻 + 許容幅）に変換する。
 * 企画書 5.3 節: 希望時刻を中心に ±flexibilityMinutes の窓を設ける。
 */
export function convertApproxTime(
  preferredTime: string,
  flexibilityMinutes = 30,
): ApproxTimeRange {
  const preferred = normalizeTimeString(preferredTime);
  return {
    preferredTime: preferred,
    earliestTime: subtractMinutesFromTime(preferred, flexibilityMinutes),
    latestTime: addMinutesToTime(preferred, flexibilityMinutes),
  };
}

/** 時刻文字列を "HH:mm" に正規化する。 */
export function normalizeTimeString(time: string): TimeString {
  const parts = time.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as TimeString;
}

/** 指定日が土日かどうかを判定する。 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 生活リズムの適用日（平日/休日/毎日）が、指定日に該当するか判定する。
 */
export function appliesToDate(
  appliesTo: "weekday" | "weekend" | "both",
  date: Date,
): boolean {
  if (appliesTo === "both") return true;
  const weekend = isWeekend(date);
  return appliesTo === "weekend" ? weekend : !weekend;
}

/**
 * 重複する時間ブロックをマージする。
 * 空き時間計算の前処理として使用する。
 */
export function mergeOverlappingBlocks(
  blocks: Array<{ startMinutes: number; endMinutes: number }>,
): Array<{ startMinutes: number; endMinutes: number }> {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);
  const merged: Array<{ startMinutes: number; endMinutes: number }> = [
    sorted[0]!,
  ];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (current.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, current.endMinutes);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** 空き時間スロット（内部計算用） */
interface FreeTimeSlotLike {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

/**
 * 指定範囲からブロック時間を差し引き、空き時間スロット一覧を返す。
 */
export function subtractBlocksFromRange(
  rangeStart: number,
  rangeEnd: number,
  blocks: Array<{ startMinutes: number; endMinutes: number }>,
): FreeTimeSlotLike[] {
  const merged = mergeOverlappingBlocks(
    blocks.filter((b) => b.endMinutes > rangeStart && b.startMinutes < rangeEnd),
  );

  const slots: FreeTimeSlotLike[] = [];
  let cursor = rangeStart;

  for (const block of merged) {
    const blockStart = Math.max(block.startMinutes, rangeStart);
    const blockEnd = Math.min(block.endMinutes, rangeEnd);
    if (cursor < blockStart) {
      slots.push({
        startMinutes: cursor,
        endMinutes: blockStart,
        durationMinutes: blockStart - cursor,
      });
    }
    cursor = Math.max(cursor, blockEnd);
  }

  if (cursor < rangeEnd) {
    slots.push({
      startMinutes: cursor,
      endMinutes: rangeEnd,
      durationMinutes: rangeEnd - cursor,
    });
  }

  return slots.filter((slot) => slot.durationMinutes > 0);
}
