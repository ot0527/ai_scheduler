import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExportData, useDeleteAccount } from "@/hooks/useDataRights";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { Download, Loader2, Trash2 } from "lucide-react";

export function DataRightsPage() {
  const navigate = useNavigate();
  const exportMutation = useExportData();
  const deleteMutation = useDeleteAccount();
  const [confirmText, setConfirmText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setMessage(null);
    setError(null);
    try {
      const data = await exportMutation.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-scheduler-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("データをエクスポートしました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エクスポートに失敗しました");
    }
  };

  const handleDelete = async () => {
    setMessage(null);
    setError(null);
    try {
      await deleteMutation.mutateAsync(confirmText);
      navigate("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  return (
    <div>
      <PageHeader
        title="データの管理"
        description="自分のデータをエクスポートするか、アカウントを完全に削除できます。"
      />

      <Card className="mb-6 p-6">
        <h2 className="text-sm font-semibold text-notion-text">データエクスポート</h2>
        <p className="mt-2 text-sm text-notion-muted">
          目標・予定・設定など、あなたのデータを JSON 形式でダウンロードします。
          API キー本体は含まれません。
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => void handleExport()}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          JSON をダウンロード
        </Button>
      </Card>

      <Card className="border-red-200 p-6">
        <h2 className="text-sm font-semibold text-notion-danger">
          アカウント削除
        </h2>
        <p className="mt-2 text-sm text-notion-muted">
          すべての目標・予定・AI 設定・Vault の API キーを完全に削除します。
          この操作は取り消せません。
        </p>

        <div className="mt-4 max-w-sm">
          <Label>確認のため「削除する」と入力</Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="削除する"
            className="mt-1"
          />
        </div>

        <Button
          className="mt-4"
          variant="danger"
          onClick={() => void handleDelete()}
          disabled={confirmText !== "削除する" || deleteMutation.isPending}
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          アカウントを削除
        </Button>
      </Card>

      {message && (
        <p className="mt-4 text-sm text-notion-success">{message}</p>
      )}
      {error && <p className="mt-4 text-sm text-notion-danger">{error}</p>}
    </div>
  );
}
