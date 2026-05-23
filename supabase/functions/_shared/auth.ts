import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { errorResponse } from "./cors.ts";

export interface AuthContext {
  userId: string;
  authHeader: string;
}

/**
 * Authorization ヘッダーから JWT を検証し、ユーザー ID を返す。
 */
export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("認証が必要です", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("サーバー設定が不足しています", 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return errorResponse("認証に失敗しました", 401);
  }

  return { userId: user.id, authHeader };
}

export function createUserClient(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  return createClient(supabaseUrl, serviceRoleKey);
}
