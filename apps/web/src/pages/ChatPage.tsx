import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ChatHistoryItem } from "@ai-scheduler/core";
import { useAiSettings } from "@/hooks/useGoals";
import { useChatConsultation, type ChatMessage } from "@/hooks/useChat";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { Loader2, Send } from "lucide-react";

export function ChatPage() {
  const aiSettingsQuery = useAiSettings();
  const chatMutation = useChatConsultation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;

    setError(null);
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const history: ChatHistoryItem[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await chatMutation.mutateAsync({
        message: trimmed,
        history,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          suggestedActions: result.suggestedActions,
        },
      ]);

      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    }
  };

  const configured = aiSettingsQuery.data?.configured;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-6rem)]">
      <PageHeader
        title="AI 相談"
        description="目標や予定について自由に相談できます。変更は自動反映されません。"
      />

      {!configured && !aiSettingsQuery.isLoading && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50 p-4 text-sm">
          <p className="text-amber-900">
            AI API キーが未設定です。{" "}
            <Link to="/settings/ai" className="underline">
              AI 設定
            </Link>
            から登録してください。
          </p>
        </Card>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={listRef}
          className="flex-1 space-y-4 overflow-y-auto p-4"
        >
          {messages.length === 0 && (
            <EmptyState
              title="何でも相談してください"
              description="例: 「今週の英語学習が遅れているけど、どう調整すればいい？」"
            />
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={
                msg.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  msg.role === "user"
                    ? "max-w-[85%] rounded-lg bg-notion-accent px-4 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-lg bg-notion-hover px-4 py-3 text-sm text-notion-text"
                }
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-notion-border/50 pt-2 text-xs text-notion-muted">
                    {msg.suggestedActions.map((action, i) => (
                      <li key={i}>
                        <span className="font-medium text-notion-text">
                          {action.label}
                        </span>
                        {action.description && ` — ${action.description}`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-notion-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              回答を生成中…
            </div>
          )}
        </div>

        {error && (
          <p className="border-t border-notion-border px-4 py-2 text-sm text-notion-danger">
            {error}
          </p>
        )}

        <div className="flex gap-2 border-t border-notion-border p-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力…"
            disabled={!configured || chatMutation.isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!configured || !input.trim() || chatMutation.isPending}
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
