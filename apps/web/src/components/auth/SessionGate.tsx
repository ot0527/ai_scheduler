import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Supabase セッションの準備が完了するまで待機し、準備完了後に子ルートを描画する。
 */
export function SessionGate() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-notion-bg">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex h-full items-center justify-center bg-notion-bg px-4">
        <p className="max-w-md text-center text-sm text-notion-danger">
          {error?.message ??
            "セッションの開始に失敗しました。apps/web/.env の Supabase 設定を確認してください。"}
        </p>
      </div>
    );
  }

  return <Outlet />;
}
