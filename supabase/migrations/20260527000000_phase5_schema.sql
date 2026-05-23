-- Phase 5: 通知設定、AI 口調、ログ保持期間

-- ---------------------------------------------------------------------------
-- user_preferences: 通知設定
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{
    "showDetailedAlerts": false,
    "enablePushNotifications": false
  }'::jsonb;

COMMENT ON COLUMN public.user_preferences.notification_settings IS
  '通知プライバシー設定。showDetailedAlerts=false 時はアラート本文を伏せ字表示。';

-- ---------------------------------------------------------------------------
-- user_ai_settings: AI 相談の口調
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_ai_settings
  ADD COLUMN IF NOT EXISTS ai_tone TEXT NOT NULL DEFAULT 'polite'
    CHECK (ai_tone IN ('polite', 'casual', 'concise'));

COMMENT ON COLUMN public.user_ai_settings.ai_tone IS
  'AI 相談・説明文の口調（polite / casual / concise）。';

-- ---------------------------------------------------------------------------
-- AI リクエストログの定期削除（90日超）
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_old_ai_request_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.ai_request_logs
  WHERE created_at < now() - interval '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_ai_request_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_ai_request_logs() TO service_role;
