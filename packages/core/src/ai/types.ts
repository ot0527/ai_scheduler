import type { z } from "zod";

export type AITaskType =
  | "goal_decompose"
  | "reschedule"
  | "chat"
  | "test_connection";

export type AIProvider = "openai" | "gemini";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIResponse<T> {
  data: T;
  tokenUsage: TokenUsage;
  provider: AIProvider;
  model: string;
}

export interface CallAIParams<T extends z.ZodType> {
  taskType: AITaskType;
  systemInstruction: string;
  userData: Record<string, unknown>;
  responseSchema: T;
  provider: AIProvider;
  model: string;
  apiKey: string;
}
