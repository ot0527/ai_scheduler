import { useEffect, useState } from "react";
import {
  useNotificationSettings,
  useSaveNotificationSettings,
} from "@/hooks/usePhase5";
import { Button, Card, PageHeader } from "@/components/ui";
import { Loader2 } from "lucide-react";

export function NotificationSettingsPage() {
  const settingsQuery = useNotificationSettings();
  const saveMutation = useSaveNotificationSettings();
  const [showDetailedAlerts, setShowDetailedAlerts] = useState(false);
  const [enablePush, setEnablePush] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setShowDetailedAlerts(settingsQuery.data.showDetailedAlerts);
    setEnablePush(settingsQuery.data.enablePushNotifications);
  }, [settingsQuery.data]);

  const handleSave = async () => {
    setMessage(null);
    try {
      await saveMutation.mutateAsync({
        showDetailedAlerts,
        enablePushNotifications: enablePush,
      });
      setMessage("保存しました");
    } catch {
      setMessage("保存に失敗しました");
    }
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="通知設定"
        description="ロック画面や通知に表示する内容のプライバシーを管理します。"
      />

      <Card className="space-y-6 p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={showDetailedAlerts}
            onChange={(e) => setShowDetailedAlerts(e.target.checked)}
            className="mt-1"
          />
          <div>
            <p className="text-sm font-medium text-notion-text">
              アラートに詳細を表示する
            </p>
            <p className="mt-1 text-xs text-notion-muted">
              オフの場合、目標名や進捗は伏せ字表示（例:「今日の予定の確認事項があります」）になります。
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={enablePush}
            onChange={(e) => setEnablePush(e.target.checked)}
            className="mt-1"
          />
          <div>
            <p className="text-sm font-medium text-notion-text">
              プッシュ通知を有効にする（準備中）
            </p>
            <p className="mt-1 text-xs text-notion-muted">
              PWA の Web Push 対応時に利用されます。現時点ではアプリ内アラートのみ反映されます。
            </p>
          </div>
        </label>

        {message && (
          <p className="text-sm text-notion-success">{message}</p>
        )}

        <Button onClick={() => void handleSave()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          保存
        </Button>
      </Card>
    </div>
  );
}
