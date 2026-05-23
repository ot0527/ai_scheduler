/**
 * フォーム入力・API レスポンスで共通利用する Zod 用の正規表現と定数。
 */

/** PostgreSQL TIME 型および HTML time input 互換の時刻形式 */
export const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export { DEFAULT_FLEXIBILITY_MINUTES } from "../scheduling/constants.js";
