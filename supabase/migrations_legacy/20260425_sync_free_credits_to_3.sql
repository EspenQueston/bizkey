-- ============================================================
-- Sync free credits to 3 everywhere (homepage + dashboard)
-- ============================================================

-- 1. Change default for new profiles from 5 to 3
ALTER TABLE profiles
  ALTER COLUMN basic_credits_remaining SET DEFAULT 3;

-- 2. Also change credits_remaining default to 3 (legacy field used by analyze edge function)
ALTER TABLE profiles
  ALTER COLUMN credits_remaining SET DEFAULT 3;

-- 3. Update existing free-tier users who still have 5 credits (never used any)
UPDATE profiles
SET basic_credits_remaining = 3
WHERE subscription_tier = 'free'
  AND basic_credits_remaining = 5;

-- 4. Update the free plan in plans table to reflect 3 credits
UPDATE plans
SET basic_credits = 3
WHERE name = 'free';

-- 5. Update the seed/insert for new plan records (handled by DEFAULT change above)
-- Also update plans seeded with 5 credits for free tier:
UPDATE plans
SET basic_credits = 3
WHERE name IN ('free', 'payg_starter') AND basic_credits = 5;
