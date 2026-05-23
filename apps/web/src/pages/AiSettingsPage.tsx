import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AI_PROVIDER_LABELS,
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const models = provider === "openai" ? OPENAI_MODELS : GEMINI_MODELS;

  const handleProviderChange = (next: "openai" | "gemini") => {
    setProvider(next);
    setModel(next === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash");
  };

  const handleSave = async () => {
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
      });
      setApiKey("");
      setMessage("接続テストに成功し、API キーを保存しました。");
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

          <div className="sm:col-span-2">
            <Label>API キー</Label>
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

          <div>
            <Label>月間トークン上限（任意）</Label>
            <Input
              type="number"
              min={1000}
              value={monthlyTokenLimit}
              onChange={(e) => setMonthlyTokenLimit(e.target.value)}
              placeholder="例: 100000"
            />
          </div>
        </div>

        {message && (
          <p className="mt-4 text-sm text-notion-success">{message}</p>
        )}
        {error && <p className="mt-4 text-sm text-notion-danger">{error}</p>}

        <div className="mt-6">
          <Button onClick={handleSave} disabled={saveMutation.isPending || !apiKey}>
            {saveMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            接続テストして保存
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
