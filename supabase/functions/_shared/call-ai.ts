import type { z } from "https://esm.sh/zod@3.25.67";
import type { AIProvider, TokenUsage } from "../../../packages/core/dist/ai/types.js";

interface CallAIResult<T> {
  data: T;
  tokenUsage: TokenUsage;
}

export interface CallAIOptions {
  preprocess?: (raw: unknown) => unknown;
  /** 生成トークン上限（デフォルト 8192） */
  maxOutputTokens?: number;
  /** JSON パース失敗・出力途切れ時の再試行回数（デフォルト 1） */
  maxRetries?: number;
}

const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

const RETRY_USER_HINT =
  "前回の出力が長すぎて JSON が途中で切れました。summary は300文字以内、components 最大10件、workBlocks 最大20件に絞り、JSON のみ返してください。";

/**
 * AI 呼び出しエラー。retriable が true の場合のみ再試行対象
 * （出力途切れ・JSON 不正・スキーマ検証失敗など、再実行で解消しうるもの）。
 */
export class AIError extends Error {
  readonly retriable: boolean;

  constructor(message: string, options?: { retriable?: boolean }) {
    super(message);
    this.name = "AIError";
    this.retriable = options?.retriable ?? false;
  }
}

/**
 * OpenAI Chat Completions API を呼び出し、JSON 出力を Zod で検証する。
 */
async function callOpenAI<T>(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userData: Record<string, unknown>,
  responseSchema: z.ZodType<T>,
  options?: CallAIOptions,
): Promise<CallAIResult<T>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      max_completion_tokens: options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: systemInstruction },
        {
          role: "user",
          content: `<user_data>\n${JSON.stringify(userData)}\n</user_data>`,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`OpenAI API error: ${response.status}`, body.slice(0, 500));
    throw new AIError("OpenAI API の呼び出しに失敗しました");
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  const finishReason = json.choices?.[0]?.finish_reason;
  // トークン上限は本文の有無より先に判定する（本文なしで途切れた場合も再試行対象）
  if (finishReason === "length") {
    throw new AIError(
      "OpenAI の出力が途中で切れました（トークン上限）。もう一度お試しください。",
      { retriable: true },
    );
  }

  if (!content) throw new AIError("OpenAI response is empty");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    console.error("OpenAI returned invalid JSON");
    throw new AIError("OpenAI の出力形式が不正です", { retriable: true });
  }

  if (options?.preprocess) parsedJson = options.preprocess(parsedJson);

  const parsed = responseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error("AI output validation failed:", parsed.error.message);
    throw new AIError("AI 出力の検証に失敗しました", { retriable: true });
  }

  return {
    data: parsed.data,
    tokenUsage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Google Gemini API を呼び出し、JSON 出力を Zod で検証する。
 */
async function callGemini<T>(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userData: Record<string, unknown>,
  responseSchema: z.ZodType<T>,
  options?: CallAIOptions,
): Promise<CallAIResult<T>> {
  // API キーは URL ではなくヘッダーで渡す（アクセスログへの漏洩防止）
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    maxOutputTokens: options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
  };
  // Gemini 3.5 系は temperature 非推奨
  if (!model.startsWith("gemini-3.5")) {
    generationConfig.temperature = 0.2;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `<user_data>\n${JSON.stringify(userData)}\n</user_data>`,
            },
          ],
        },
      ],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Gemini API error: ${response.status}`, body.slice(0, 500));
    throw new AIError("Gemini API の呼び出しに失敗しました");
  }

  const json = await response.json();
  const candidate = json.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text;
  const finishReason = candidate?.finishReason;

  // MAX_TOKENS は本文の有無より先に判定する。
  // 本文なしで途切れた場合も再試行対象（本文有無を先に見ると retriable=false になる回帰）
  if (finishReason === "MAX_TOKENS") {
    throw new AIError(
      "Gemini の出力が途中で切れました（MAX_TOKENS）。もう一度お試しください。",
      { retriable: true },
    );
  }

  if (!content) {
    const reason =
      finishReason ??
      json.promptFeedback?.blockReason ??
      "UNKNOWN";
    throw new AIError(`Gemini response is empty (${reason})`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    console.error("Gemini returned invalid JSON");
    throw new AIError("Gemini の出力形式が不正です", { retriable: true });
  }

  if (options?.preprocess) parsedJson = options.preprocess(parsedJson);

  const parsed = responseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error("AI output validation failed:", parsed.error.message);
    throw new AIError("AI 出力の検証に失敗しました", { retriable: true });
  }

  const usage = json.usageMetadata ?? {};

  return {
    data: parsed.data,
    tokenUsage: {
      promptTokens: usage.promptTokenCount ?? 0,
      completionTokens: usage.candidatesTokenCount ?? 0,
      totalTokens: usage.totalTokenCount ?? 0,
    },
  };
}

/**
 * プロバイダ抽象化レイヤー。Zod 検証済みのデータを返す。
 * JSON パース失敗・出力途切れ時は最大 1 回再試行する。
 */
export async function callAI<T>(
  provider: AIProvider,
  model: string,
  apiKey: string,
  systemInstruction: string,
  userData: Record<string, unknown>,
  responseSchema: z.ZodType<T>,
  options?: CallAIOptions,
): Promise<CallAIResult<T>> {
  const invoke = provider === "openai" ? callOpenAI : callGemini;
  const maxRetries = options?.maxRetries ?? 1;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const payload =
        attempt === 0
          ? userData
          : { ...userData, retryHint: RETRY_USER_HINT };

      return await invoke(
        apiKey,
        model,
        systemInstruction,
        payload,
        responseSchema,
        options,
      );
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("AI 呼び出しに失敗しました");

      const retriable = error instanceof AIError && error.retriable;
      if (attempt >= maxRetries || !retriable) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("AI 呼び出しに失敗しました");
}

/**
 * API キーの疎通確認用。最小リクエストを送る。
 */
export async function testAIConnection(
  provider: AIProvider,
  model: string,
  apiKey: string,
): Promise<TokenUsage> {
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_completion_tokens: 5,
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI 接続に失敗しました");
    }

    const json = await response.json();
    return {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const generationConfig: Record<string, unknown> = { maxOutputTokens: 5 };
  if (!model.startsWith("gemini-3.5")) {
    generationConfig.temperature = 0.2;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    console.error("Gemini connection test failed");
    throw new Error("Gemini 接続に失敗しました");
  }

  const json = await response.json();
  const usage = json.usageMetadata ?? {};
  return {
    promptTokens: usage.promptTokenCount ?? 0,
    completionTokens: usage.candidatesTokenCount ?? 0,
    totalTokens: usage.totalTokenCount ?? 0,
  };
}
