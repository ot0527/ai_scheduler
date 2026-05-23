import { addDays, parseDateKey, toDateKey } from "./week-utils.js";
import type { FreeTimeResult } from "./types.js";
import type { WorkBlockTemplateInput } from "./scoring.js";
import { fitBlockDuration } from "./scoring.js";
import type { PlacedBlock } from "./placement.js";

/** 小規模リスケの再配置候補 */
export interface RescheduleCandidate {
  sourceBlockId: string;
  workBlockTemplateId: string | null;
  goalId: string;
  componentId: string | null;
  title: string;
  remainingMinutes: number;
}

/** 小規模リスケの配置結果 */
export interface MinorReschedulePlacement {
  targetDateKey: string;
  block: PlacedBlock;
  candidate: RescheduleCandidate;
}

/** 小規模リスケの探索結果 */
export interface MinorReschedulePlan {
  placements: MinorReschedulePlacement[];
  unplaced: RescheduleCandidate[];
}

/** 小規模リスケの探索オプション */
export interface MinorRescheduleOptions {
  /** 探索開始日（通常は翌日） */
  startDateKey: string;
  /** 探索日数（デフォルト 7） */
  maxDays?: number;
}

/**
 * 再配置探索対象の日付キー一覧を返す。
 *
 * @param startDateKey - 探索開始日
 * @param maxDays - 探索日数
 */
export function buildRescheduleSearchDates(
  startDateKey: string,
  maxDays = 7,
): string[] {
  const dates: string[] = [];
  const start = parseDateKey(startDateKey);

  for (let i = 0; i < maxDays; i++) {
    dates.push(toDateKey(addDays(start, i)));
  }

  return dates;
}

/**
 * 未完了ブロック用に作業テンプレートを調整する。
 * 残り分数が min 未満の場合は min を引き下げる。
 *
 * @param template - 元テンプレート
 * @param remainingMinutes - 再配置対象の分数
 */
export function adaptTemplateForReschedule(
  template: WorkBlockTemplateInput,
  remainingMinutes: number,
): WorkBlockTemplateInput {
  const minMinutes = Math.min(template.minMinutes, remainingMinutes);
  const idealMinutes = Math.min(
    Math.max(minMinutes, template.idealMinutes),
    remainingMinutes,
  );
  const maxMinutes = Math.max(idealMinutes, remainingMinutes);

  return {
    ...template,
    minMinutes: Math.max(1, minMinutes),
    idealMinutes,
    maxMinutes,
  };
}

/**
 * テンプレート情報がない場合の最小テンプレートを生成する。
 *
 * @param candidate - 再配置候補
 */
export function buildFallbackTemplate(
  candidate: RescheduleCandidate,
): WorkBlockTemplateInput {
  const minutes = candidate.remainingMinutes;
  return {
    id: candidate.workBlockTemplateId ?? candidate.sourceBlockId,
    goalId: candidate.goalId,
    componentId: candidate.componentId ?? "",
    title: candidate.title,
    minMinutes: minutes,
    idealMinutes: minutes,
    maxMinutes: minutes,
    energy: "low",
    preferredTime: [],
    requiresDeepWork: false,
    orderType: "flexible",
  };
}

/**
 * 空き時間内で単一ブロックの最適配置を探す。
 *
 * @param freeTime - 空き時間
 * @param template - 作業テンプレート
 */
export function findBestSlotForBlock(
  freeTime: FreeTimeResult,
  template: WorkBlockTemplateInput,
): { startMinutes: number; endMinutes: number; plannedMinutes: number } | null {
  let best: {
    startMinutes: number;
    endMinutes: number;
    plannedMinutes: number;
    duration: number;
  } | null = null;

  for (const slot of freeTime.freeSlots) {
    const duration = fitBlockDuration(slot, template);
    if (duration === 0) continue;

    if (!best || duration > best.duration) {
      best = {
        startMinutes: slot.startMinutes,
        endMinutes: slot.startMinutes + duration,
        plannedMinutes: duration,
        duration,
      };
    }
  }

  if (!best) return null;

  return {
    startMinutes: best.startMinutes,
    endMinutes: best.endMinutes,
    plannedMinutes: best.plannedMinutes,
  };
}

/**
 * 未完了ブロックを翌日以降の空き時間へ再配置する計画を作成する。
 *
 * @param candidates - 再配置候補
 * @param getFreeTimeForDate - 日付ごとの空き時間取得関数
 * @param getTemplate - テンプレート取得関数
 * @param options - 探索オプション
 */
export async function planMinorReschedule(
  candidates: RescheduleCandidate[],
  getFreeTimeForDate: (dateKey: string) => Promise<FreeTimeResult | null>,
  getTemplate: (candidate: RescheduleCandidate) => WorkBlockTemplateInput | null,
  options: MinorRescheduleOptions,
): Promise<MinorReschedulePlan> {
  const searchDates = buildRescheduleSearchDates(
    options.startDateKey,
    options.maxDays ?? 7,
  );

  const placements: MinorReschedulePlacement[] = [];
  const unplaced: RescheduleCandidate[] = [];
  const usedDates = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.remainingMinutes <= 0) continue;

    let placed = false;

    for (const dateKey of searchDates) {
      if (usedDates.has(dateKey)) continue;

      const freeTime = await getFreeTimeForDate(dateKey);
      if (!freeTime) continue;

      const baseTemplate = getTemplate(candidate) ?? buildFallbackTemplate(candidate);
      const template = adaptTemplateForReschedule(baseTemplate, candidate.remainingMinutes);
      const slot = findBestSlotForBlock(freeTime, template);

      if (!slot) continue;

      placements.push({
        targetDateKey: dateKey,
        candidate,
        block: {
          workBlockTemplateId: template.id,
          goalId: candidate.goalId,
          componentId: candidate.componentId ?? "",
          title: candidate.title,
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          plannedMinutes: slot.plannedMinutes,
          orderType: template.orderType,
          score: 0,
        },
      });

      usedDates.add(dateKey);
      placed = true;
      break;
    }

    if (!placed) {
      unplaced.push(candidate);
    }
  }

  return { placements, unplaced };
}

/** week-utils の addDays を reschedule からも利用 */
export { addDays } from "./week-utils.js";
