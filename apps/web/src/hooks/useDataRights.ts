import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { invokeFunction } from "@/lib/edge-functions";

/** ユーザーデータを JSON でエクスポートする。 */
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      return invokeFunction<Record<string, unknown>>("export-data", {
        method: "GET",
      });
    },
  });
}

/** アカウントと全データを削除する。 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (confirmText: string) => {
      return invokeFunction<{ deleted: boolean }>("delete-account", {
        body: { confirmText },
      });
    },
    onSuccess: async () => {
      await supabase.auth.signOut();
    },
  });
}
