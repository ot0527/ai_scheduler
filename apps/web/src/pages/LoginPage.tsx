import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button, Card, Input, Label } from "@/components/ui";

/**
 * メール / パスワードによるログイン・新規登録画面。
 * 資格情報はクライアントに埋め込まず、ユーザー入力のみで認証する。
 */
export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signIn") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMessage(
          "登録しました。確認メールが有効な場合はメール内のリンクを開いてください。",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "認証に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-notion-bg px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-notion-text">
          AI秘書スケジュール
        </h1>
        <p className="mb-6 text-sm text-notion-muted">
          {mode === "signIn"
            ? "メールアドレスとパスワードでログイン"
            : "新しいアカウントを作成"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>メールアドレス</Label>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <Label>パスワード</Label>
            <Input
              type="password"
              autoComplete={
                mode === "signIn" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
            />
          </div>

          {error && (
            <p className="text-sm text-notion-danger">{error}</p>
          )}
          {message && (
            <p className="text-sm text-notion-success">{message}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signIn" ? "ログイン" : "アカウント作成"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-notion-muted">
          {mode === "signIn" ? (
            <>
              アカウントをお持ちでない方は{" "}
              <button
                type="button"
                className="text-notion-accent hover:underline"
                onClick={() => {
                  setMode("signUp");
                  setError(null);
                  setMessage(null);
                }}
              >
                新規登録
              </button>
            </>
          ) : (
            <>
              すでにアカウントがある方は{" "}
              <button
                type="button"
                className="text-notion-accent hover:underline"
                onClick={() => {
                  setMode("signIn");
                  setError(null);
                  setMessage(null);
                }}
              >
                ログイン
              </button>
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
