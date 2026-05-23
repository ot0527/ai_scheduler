import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * 環境変数から自動サインイン用の資格情報を取得する。
 * ログイン UI は使わず、起動時にバックグラウンドでセッションを確立する。
 */
function getAutoSignInCredentials() {
  const email = import.meta.env.VITE_SUPABASE_AUTH_EMAIL;
  const password = import.meta.env.VITE_SUPABASE_AUTH_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

/**
 * Supabase セッションを管理する。
 * 未ログイン時は .env の資格情報で自動サインインする（RLS 用）。
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (cancelled) return;

      if (sessionError) {
        setError(sessionError);
        setLoading(false);
        return;
      }

      let nextSession = sessionData.session;

      if (!nextSession) {
        const credentials = getAutoSignInCredentials();
        if (!credentials) {
          setError(
            new Error(
              "apps/web/.env に VITE_SUPABASE_AUTH_EMAIL と VITE_SUPABASE_AUTH_PASSWORD を設定してください。Supabase Dashboard でユーザーを作成し、メールとパスワードを入れてください。",
            ),
          );
          setLoading(false);
          return;
        }

        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword(credentials);
        if (cancelled) return;

        if (signInError) {
          setError(signInError);
          setLoading(false);
          return;
        }

        nextSession = signInData.session;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    }

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading, error };
}
