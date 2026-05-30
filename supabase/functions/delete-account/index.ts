import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceClient,
  requireAuth,
} from "../_shared/auth.ts";
import {
  errorResponse,
  getCorsHeaders,
  internalErrorResponse,
  jsonResponse,
} from "../_shared/cors.ts";

/**
 * ユーザーのアカウントと全データを削除する。
 * Vault の API キーも破棄し、auth.users を削除する（CASCADE）。
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const confirmText = body?.confirmText as string | undefined;

  if (confirmText !== "削除する") {
    return errorResponse('確認のため「削除する」と入力してください', 400, req);
  }

  const serviceClient = createServiceClient();

  const { data: aiSettings } = await serviceClient
    .from("user_ai_settings")
    .select("api_key_ref")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (aiSettings?.api_key_ref) {
    const { error: vaultError } = await serviceClient.rpc(
      "delete_user_api_key",
      {
        p_secret_id: aiSettings.api_key_ref,
        p_user_id: auth.userId,
      },
    );
    if (vaultError) {
      console.error("vault delete failed:", vaultError.message);
    }
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(
    auth.userId,
  );

  if (deleteError) {
    return internalErrorResponse("delete-account", deleteError, req);
  }

  return jsonResponse({ deleted: true }, 200, req);
});
