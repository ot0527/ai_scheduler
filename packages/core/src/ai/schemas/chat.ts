import { z } from "zod";
import { AI_LIMITS } from "../constants.js";

const suggestedActionSchema = z.object({
  label: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
});

/** AI 相談チャットの出力スキーマ。 */
export const chatOutputSchema = z
  .object({
    reply: z.string().min(1).max(AI_LIMITS.chatMaxReplyChars),
    suggestedActions: z
      .array(suggestedActionSchema)
      .max(AI_LIMITS.chatMaxSuggestedActions)
      .optional(),
  })
  .strict();

export type ChatOutput = z.infer<typeof chatOutputSchema>;

/** チャット履歴1件の入力スキーマ。 */
export const chatHistoryItemSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(AI_LIMITS.chatMaxMessageChars),
  })
  .strict();

export type ChatHistoryItem = z.infer<typeof chatHistoryItemSchema>;

/** AI 相談リクエストの入力スキーマ。 */
export const chatRequestSchema = z
  .object({
    message: z.string().min(1).max(AI_LIMITS.chatMaxMessageChars),
    history: z.array(chatHistoryItemSchema).max(AI_LIMITS.chatMaxHistoryItems).default([]),
  })
  .strict();

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
