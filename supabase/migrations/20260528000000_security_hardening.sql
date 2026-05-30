-- セキュリティ強化: user_ai_settings のクライアント直接書き込み禁止、Vault RPC に所有者検証

-- ---------------------------------------------------------------------------
-- user_ai_settings: INSERT/UPDATE は Edge Function (service_role) 経由のみ
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_ai_settings_insert_own" ON public.user_ai_settings;
DROP POLICY IF EXISTS "user_ai_settings_update_own" ON public.user_ai_settings;

-- ---------------------------------------------------------------------------
-- Vault RPC: シークレットの所有者を検証
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_api_key_by_ref(UUID);

CREATE OR REPLACE FUNCTION public.get_api_key_by_ref(
  p_secret_id UUID,
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_ai_settings
    WHERE user_id = p_user_id
      AND api_key_ref = p_secret_id::text
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;

  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_api_key_by_ref(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_api_key_by_ref(UUID, UUID) TO service_role;

DROP FUNCTION IF EXISTS public.delete_user_api_key(UUID);

CREATE OR REPLACE FUNCTION public.delete_user_api_key(
  p_secret_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_ai_settings
    WHERE user_id = p_user_id
      AND api_key_ref = p_secret_id::text
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM vault.secrets WHERE id = p_secret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_api_key(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_api_key(UUID, UUID) TO service_role;
