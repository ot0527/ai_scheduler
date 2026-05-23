-- Vault から API キーを service_role で取得する RPC（Edge Functions 用）

CREATE OR REPLACE FUNCTION public.get_api_key_by_ref(p_secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;

  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_api_key_by_ref(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_api_key_by_ref(UUID) TO service_role;
