import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AI_PROVIDER_LABELS,
  AI_TONE_LABELS,
  GEMINI_MODELS,
  GEMINI_MODEL_LABELS,
  OPENAI_MODELS,
} from "@ai-scheduler/core";
import { useAiSettings, useSaveAiSettings } from "@/hooks/useGoals";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";
import { CheckCircle2, Loader2 } from "lucide-react";

export function AiSettingsPage() {
  const navigate = useNavigate();
  const settingsQuery = useAiSettings();
  const saveMutation = useSaveAiSettings();

  const [provider, setProvider] = useState<"openai" | "gemini">("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState("");
  const [aiTone, setAiTone] = useState<"polite" | "casual" | "concise">("polite");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const models = provider === "openai" ? OPENAI_MODELS : GEMINI_MODELS;

  useEffect(() => {
    if (!settingsQuery.data) return;
    const s = settingsQuery.data;
    setProvider(s.provider);
    setModel(s.model);
    setMonthlyTokenLimit(
      s.monthlyTokenLimit != null ? String(s.monthlyTokenLimit) : "",
    );
    setAiTone(s.aiTone ?? "polite");
  }, [settingsQuery.data]);

  const handleProviderChange = (next: "openai" | "gemini") => {
    setProvider(next);
    setModel(next === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash");
  };

  const handleSaveKey = async () => {
    setMessage(null);
    setError(null);
    try {
      await saveMutation.mutateAsync({
        provider,
        model,
        apiKey,
        monthlyTokenLimit: monthlyTokenLimit
          ? Number(monthlyTokenLimit)
          : null,
        aiTone,
      });
      setApiKey("");
      setMessage("接続テストに成功し、API キーを保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  const handleSavePreferences = async () => {
    setMessage(null);
    setError(null);
    try {
      await saveMutation.mutateAsync({
        provider,
        model,
        monthlyTokenLimit: monthlyTokenLimit
          ? Number(monthlyTokenLimit)
          : null,
        aiTone,
      });
      setMessage("設定を保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  const current = settingsQuery.data;

  return (
    <div>
      <PageHeader
        title="AI 設定"
        description="BYOK（Bring Your Own Key）方式で API キーを登録します。キーは Vault に暗号化保存され、クライアントには表示されません。"
        action={
          <Button variant="secondary" onClick={() => navigate("/goals")}>
            目標へ
          </Button>
        }
      />

      {current?.configured && (
        <Card className="mb-6 flex items-start gap-3 border-emerald-200 bg-emerald-50/50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-notion-success" />
          <div className="text-sm">
            <p className="font-medium text-notion-text">
              {AI_PROVIDER_LABELS[current.provider]} / {current.model}
            </p>
            <p className="text-notion-muted">
              登録済みキー: ****{current.apiKeyLast4}
              {current.monthlyTokenLimit &&
                ` · 月間上限 ${current.monthlyTokenLimit.toLocaleString()} トークン`}
              {" · "}
              今月の使用量 {current.tokensUsedThisMonth.toLocaleString()} トークン
            </p>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>プロバイダ</Label>
            <Select
              value={provider}
              onChange={(e) =>
                handleProviderChange(e.target.value as "openai" | "gemini")
              }
            >
              {Object.entries(AI_PROVIDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>モデル</Label>
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((item) => (
                <option key={item} value={item}>
                  {provider === "gemini"
                    ? GEMINI_MODEL_LABELS[item as (typeof GEMINI_MODELS)[number]]
                    : item}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>AI 相談の口調</Label>
            <Select
              value={aiTone}
              onChange={(e) =>
                setAiTone(e.target.value as "polite" | "casual" | "concise")
              }
            >
              {Object.entries(AI_TONE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>月間トークン上限（任意）</Label>
            <Input
              type="number"
              min={1000}
              value={monthlyTokenLimit}
              onChange={(e) => setMonthlyTokenLimit(e.target.value)}
              placeholder="例: 100000"
            />
            <p className="mt-1 text-xs text-notion-muted">
              上限到達時は AI 呼び出しが停止します。
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label>API キー（新規登録・変更時のみ）</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... または AIza..."
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-notion-muted">
              保存前に接続テストを行います。保存後は再表示されません。
            </p>
          </div>
        </div>

        {message && (
          <p className="mt-4 text-sm text-notion-success">{message}</p>
        )}
        {error && <p className="mt-4 text-sm text-notion-danger">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          {current?.configured && (
            <Button
              variant="secondary"
              onClick={() => void handleSavePreferences()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              口調・上限を保存
            </Button>
          )}
          <Button
            onClick={() => void handleSaveKey()}
            disabled={saveMutation.isPending || !apiKey}
          >
            {saveMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            接続テストしてキーを保存
          </Button>
        </div>
      </Card>

      <p className="mt-6 text-sm text-notion-muted">
        開発環境では Edge Function の環境変数 `OPENAI_API_KEY` /
        `GEMINI_API_KEY` を設定すると、ユーザー登録なしでも AI 分解を試せます。
      </p>
    </div>
  );
}
