-- Phase 4: 振り返り列（schedules）+ 実行記録用インデックス

ALTER TABLE public.schedules
  ADD COLUMN fatigue_level SMALLINT CHECK (
    fatigue_level IS NULL OR (fatigue_level >= 1 AND fatigue_level <= 5)
  ),
  ADD COLUMN review_note TEXT CHECK (
    review_note IS NULL OR char_length(review_note) <= 1000
  ),
  ADD COLUMN reviewed_at TIMESTAMPTZ;

CREATE INDEX idx_scheduled_blocks_status ON public.scheduled_blocks (status);
