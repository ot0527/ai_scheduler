import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Edge Function エラーレスポンスからメッセージを取り出す。
 */
async function extractFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // JSON パース失敗時は汎用メッセージへ
    }
  }

  if (error instanceof Error) return error.message;
  return "Edge Function の呼び出しに失敗しました";
}

/**
 * Edge Function を呼び出す共通ヘルパー。
 *
 * @param name - 関数名
 * @param options - リクエストオプション
 */
export async function invokeFunction<T>(
  name: string,
  options?: { method?: "GET" | "POST"; body?: Record<string, unknown> },
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    method: options?.method ?? "POST",
    body: options?.body,
  });

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error));
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }

  return data as T;
}
