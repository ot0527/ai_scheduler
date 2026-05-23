import { useMutation } from "@tanstack/react-query";
import type { ChatHistoryItem, ChatOutput } from "@ai-scheduler/core";
import { invokeFunction } from "@/lib/edge-functions";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedActions?: ChatOutput["suggestedActions"];
}

/** AI 相談チャットを送信する。 */
export function useChatConsultation() {
  return useMutation({
    mutationFn: async (input: {
      message: string;
      history: ChatHistoryItem[];
    }) => {
      return invokeFunction<{
        reply: string;
        suggestedActions: ChatOutput["suggestedActions"];
        tokenUsage: { totalTokens: number };
      }>("ai-chat", { body: input });
    },
  });
}
