-- ============================================================
-- BizKey — Credits SoT, Observability, AI Quality
-- ============================================================

-- 1) Credits source of truth and legacy deprecation support
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_model_version TEXT NOT NULL DEFAULT 'v2',
  ADD COLUMN IF NOT EXISTS legacy_credits_deprecated_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.credits_remaining IS
'DEPRECATED: legacy v1 credit field. Use basic_credits_remaining + payg_basic_credits (v2).';

-- Keep legacy field synchronized while migration is active.
CREATE OR REPLACE FUNCTION sync_legacy_credits_from_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.credits_remaining := GREATEST(
    0,
    COALESCE(NEW.basic_credits_remaining, 0) + COALESCE(NEW.payg_basic_credits, 0)
  );

  IF NEW.credit_model_version = 'v2' AND NEW.legacy_credits_deprecated_at IS NULL THEN
    NEW.legacy_credits_deprecated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_legacy_credits_from_v2 ON profiles;
CREATE TRIGGER trg_sync_legacy_credits_from_v2
BEFORE INSERT OR UPDATE OF basic_credits_remaining, payg_basic_credits, credit_model_version
ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_legacy_credits_from_v2();

-- Backfill current rows once
UPDATE profiles
SET
  credit_model_version = 'v2',
  credits_remaining = GREATEST(0, COALESCE(basic_credits_remaining, 0) + COALESCE(payg_basic_credits, 0)),
  legacy_credits_deprecated_at = COALESCE(legacy_credits_deprecated_at, now());

-- 2) Observability events
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'warn', 'error')),
  latency_ms INT,
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_events_admin_read" ON system_events;
CREATE POLICY "system_events_admin_read" ON system_events
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

DROP POLICY IF EXISTS "system_events_service_insert" ON system_events;
CREATE POLICY "system_events_service_insert" ON system_events
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role' OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

-- 3) Analysis quality tagging
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS data_source TEXT,
  ADD COLUMN IF NOT EXISTS ai_source TEXT,
  ADD COLUMN IF NOT EXISTS quality_tier TEXT,
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT;

UPDATE analyses
SET
  data_source = COALESCE(data_source, (raw_product_data->>'dataSource')),
  ai_source = COALESCE(ai_source, 'unknown'),
  quality_tier = COALESCE(quality_tier, 'unknown')
WHERE data_source IS NULL OR ai_source IS NULL OR quality_tier IS NULL;
