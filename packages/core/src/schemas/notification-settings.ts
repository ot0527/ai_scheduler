import { z } from "zod";

/** 通知プライバシー設定の Zod スキーマ。 */
export const notificationSettingsSchema = z.object({
  showDetailedAlerts: z.boolean().default(false),
  enablePushNotifications: z.boolean().default(false),
});

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  showDetailedAlerts: false,
  enablePushNotifications: false,
};

/** DB の JSONB を通知設定型に正規化する。 */
export function parseNotificationSettings(raw: unknown): NotificationSettings {
  const parsed = notificationSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_NOTIFICATION_SETTINGS;
}

export const AI_TONE_LABELS: Record<"polite" | "casual" | "concise", string> = {
  polite: "丁寧",
  casual: "カジュアル",
  concise: "簡潔",
};

/** アラート本文を通知設定に応じてマスクする。 */
export function maskAlertMessage(
  message: string,
  showDetailed: boolean,
): string {
  if (showDetailed) return message;
  return "今日の予定や目標の確認事項があります。詳細はアプリ内でご確認ください。";
}
