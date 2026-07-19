-- コードレビュー対応:
-- 1. 日跨ぎ（終了 <= 開始）の固定予定・配置ブロックを DB でも許可する。
--    アプリ側は「終了が開始以前 = 翌日へ延長」と解釈する（block-builders.ts / mappers/schedule.ts）。
-- 2. alerts にアラート種別列を追加し、週次不足アラートの入れ替えが
--    他種別（大規模リスケ等）のアラートを誤削除しないようにする。

-- ---------------------------------------------------------------------------
-- 日跨ぎ固定予定の許可（例: 夜勤 22:00 → 翌 06:00）
-- ---------------------------------------------------------------------------

ALTER TABLE public.fixed_schedules
  DROP CONSTRAINT fixed_schedules_time_order;

ALTER TABLE public.fixed_schedules
  ADD CONSTRAINT fixed_schedules_time_order CHECK (start_time <> end_time);

-- ---------------------------------------------------------------------------
-- 日跨ぎ配置ブロックの許可（例: 23:30 → 翌 00:30、就寝が日を跨ぐ場合に発生）
-- ---------------------------------------------------------------------------

ALTER TABLE public.scheduled_blocks
  DROP CONSTRAINT scheduled_blocks_time_order;

ALTER TABLE public.scheduled_blocks
  ADD CONSTRAINT scheduled_blocks_time_order CHECK (start_time <> end_time);

-- ---------------------------------------------------------------------------
-- アラート種別（週次不足の入れ替え対象を種別で識別する）
-- ---------------------------------------------------------------------------

ALTER TABLE public.alerts
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'general'
  CHECK (kind IN ('general', 'weekly_shortage', 'major_reschedule'));

CREATE INDEX idx_alerts_user_kind ON public.alerts (user_id, kind);
