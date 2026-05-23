/**
 * AI 相談出力の未知フィールドを除去し、検証前に正規化する。
 *
 * @param raw - AI の生 JSON
 */
export function normalizeChatOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;

  const obj = raw as Record<string, unknown>;
  const suggestedActions = Array.isArray(obj.suggestedActions)
    ? obj.suggestedActions
        .slice(0, 3)
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const action = item as Record<string, unknown>;
          const label =
            typeof action.label === "string" ? action.label.trim() : "";
          if (!label) return null;
          const description =
            typeof action.description === "string"
              ? action.description.trim()
              : undefined;
          return description ? { label, description } : { label };
        })
        .filter((item): item is { label: string; description?: string } =>
          item !== null,
        )
    : undefined;

  return {
    reply: obj.reply,
    ...(suggestedActions && suggestedActions.length > 0
      ? { suggestedActions }
      : {}),
  };
}
