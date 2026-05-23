import type { z } from "https://esm.sh/zod@3.25.67";
import type { AIProvider, TokenUsage } from "../../../packages/core/dist/ai/types.js";

interface CallAIResult<T> {
  data: T;
  tokenUsage: TokenUsage;
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
  preprocess?: (raw: unknown) => unknown,
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
    throw new Error(`OpenAI API error: ${response.status} ${body.slice(0, 200)}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI response is empty");

  let parsedJson: unknown = JSON.parse(content);
  if (preprocess) parsedJson = preprocess(parsedJson);

  const parsed = responseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`AI output validation failed: ${parsed.error.message}`);
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
  preprocess?: (raw: unknown) => unknown,
): Promise<CallAIResult<T>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
  };
  // Gemini 3.5 系は temperature 非推奨
  if (!model.startsWith("gemini-3.5")) {
    generationConfig.temperature = 0.2;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    throw new Error(`Gemini API error: ${response.status} ${body.slice(0, 300)}`);
  }

  const json = await response.json();
  const candidate = json.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text;
  if (!content) {
    const reason =
      candidate?.finishReason ??
      json.promptFeedback?.blockReason ??
      "UNKNOWN";
    throw new Error(`Gemini response is empty (${reason})`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${content.slice(0, 200)}`);
  }

  if (preprocess) parsedJson = preprocess(parsedJson);

  const parsed = responseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`AI output validation failed: ${parsed.error.message}`);
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
 */
export async function callAI<T>(
  provider: AIProvider,
  model: string,
  apiKey: string,
  systemInstruction: string,
  userData: Record<string, unknown>,
  responseSchema: z.ZodType<T>,
  options?: { preprocess?: (raw: unknown) => unknown },
): Promise<CallAIResult<T>> {
  const invoke = provider === "openai" ? callOpenAI : callGemini;
  return invoke(
    apiKey,
    model,
    systemInstruction,
    userData,
    responseSchema,
    options?.preprocess,
  );
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
        max_tokens: 5,
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig: Record<string, unknown> = { maxOutputTokens: 5 };
  if (!model.startsWith("gemini-3.5")) {
    generationConfig.temperature = 0.2;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini 接続に失敗しました: ${body.slice(0, 200)}`);
  }

  const json = await response.json();
  const usage = json.usageMetadata ?? {};
  return {
    promptTokens: usage.promptTokenCount ?? 0,
    completionTokens: usage.candidatesTokenCount ?? 0,
    totalTokens: usage.totalTokenCount ?? 0,
  };
}
