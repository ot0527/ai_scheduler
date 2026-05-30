import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/pages/LoginPage";

/**
 * Supabase セッションの準備が完了するまで待機し、未ログイン時はログイン画面を表示する。
 */
export function SessionGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-notion-bg">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Outlet />;
}
