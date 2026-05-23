/** 週次予算・集計で使う期間（月曜始まり） */
export interface WeekPeriod {
  periodStart: string;
  periodEnd: string;
  days: Date[];
}

/**
 * Date をローカル日付キー（yyyy-MM-dd）へ変換する。
 *
 * @param date - 変換対象
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 指定日を含む週の月曜日（ローカル正午）を返す。
 *
 * @param date - 基準日
 */
function startOfWeekMonday(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const weekday = start.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + offset);
  return start;
}

/**
 * 指定日数を加算した Date を返す（元の Date は変更しない）。
 *
 * @param date - 基準日
 * @param days - 加算日数
 */
function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * 指定日を含む週（月曜〜日曜）の期間情報を返す。
 *
 * @param date - 基準日
 */
export function getWeekPeriod(date: Date): WeekPeriod {
  const start = startOfWeekMonday(date);
  const end = addDays(start, 6);
  const days: Date[] = [];

  for (let i = 0; i < 7; i++) {
    days.push(addDays(start, i));
  }

  return {
    periodStart: toDateKey(start),
    periodEnd: toDateKey(end),
    days,
  };
}

/**
 * 日付キーから Date オブジェクト（ローカル正午）を生成する。
 *
 * @param dateKey - yyyy-MM-dd
 */
export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12, 0, 0);
}

/**
 * 2 つの日付キー間の残り週数（切り上げ）を計算する。
 *
 * @param todayKey - 基準日
 * @param deadlineKey - 期限日
 */
export function calculateWeeksRemaining(todayKey: string, deadlineKey: string): number {
  const today = parseDateKey(todayKey);
  const deadline = parseDateKey(deadlineKey);
  const diffMs = deadline.getTime() - today.getTime();
  if (diffMs < 0) return 1;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(diffDays / 7));
}
