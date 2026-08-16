-- ============================================================
-- BizKey — Pricing & Payment System Migration
-- ============================================================

-- 1. Add admin flag & new credit fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS basic_credits_remaining INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS advanced_credits_remaining INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payg_basic_credits INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payg_advanced_credits INT NOT NULL DEFAULT 0;

-- 2. Plans table (fully configurable from admin)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('subscription', 'payg')),
  price_yuan DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  basic_credits INT NOT NULL DEFAULT 0,
  advanced_credits INT NOT NULL DEFAULT 0,
  duration_days INT,                           -- NULL = PAYG / no expiry
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_beta BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB,                              -- extensible fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default plans
INSERT INTO plans (name, display_name, type, price_yuan, price_usd, basic_credits, advanced_credits, duration_days, sort_order) VALUES
  ('free',         'Gratuit',       'subscription', 0,    0,    5,   0,  30,   0),
  ('standard',     'Standard',      'subscription', 72,   9.9,  150, 20, 30,   1),
  ('payg_starter', 'Starter PAYG',  'payg',         5,    0.7,  3,   0,  NULL, 10),
  ('payg_standard','Standard PAYG', 'payg',         15,   2.1,  10,  0,  NULL, 11),
  ('payg_boost',   'Boost PAYG',    'payg',         25,   3.5,  12,  3,  NULL, 12),
  ('payg_pro',     'Pro PAYG',      'payg',         50,   7.0,  18,  7,  NULL, 13)
ON CONFLICT (name) DO NOTHING;

-- 3. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  basic_credits_remaining INT NOT NULL DEFAULT 0,
  advanced_credits_remaining INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Payment transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id),
  amount_local DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  amount_usd DECIMAL(10,2),
  payment_method TEXT,             -- 'orange_money_sn', 'wave_ci', 'mtn_cm', 'stripe', etc.
  country_code TEXT,               -- 'BJ', 'TG', 'SN', etc.
  phone_number TEXT,               -- stored hashed in production
  gateway TEXT NOT NULL DEFAULT 'pending', -- 'cinetpay', 'fedapay', 'stripe', 'manual'
  gateway_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  webhook_received_at TIMESTAMPTZ,
  webhook_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Usage logs
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('basic', 'advanced')),
  credits_consumed INT NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'subscription' CHECK (source IN ('subscription', 'payg')),
  feature TEXT,                    -- 'analyze', 'compare', 'negotiate', etc.
  response_time_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Promo codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_yuan', 'fixed_usd')),
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INT,                    -- NULL = unlimited
  used_count INT NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  plan_ids UUID[],                 -- NULL = all plans
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Exchange rates cache
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'CNY',
  target_currency TEXT NOT NULL,
  rate DECIMAL(16,6) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency)
);

-- Seed initial rates (approximate)
INSERT INTO exchange_rates (base_currency, target_currency, rate) VALUES
  ('CNY', 'XOF', 90.0),
  ('CNY', 'XAF', 90.0),
  ('CNY', 'USD', 0.14),
  ('USD', 'XOF', 620.0),
  ('USD', 'XAF', 620.0)
ON CONFLICT (base_currency, target_currency) DO NOTHING;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Plans: public read, admin write
CREATE POLICY "plans_read_all" ON plans FOR SELECT USING (TRUE);
CREATE POLICY "plans_admin_write" ON plans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

-- Subscriptions: users own data, admins see all
CREATE POLICY "subscriptions_own" ON subscriptions FOR ALL USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

-- Transactions: users own data, admins see all
CREATE POLICY "transactions_own" ON payment_transactions FOR ALL USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

-- Usage logs: users own data, admins see all
CREATE POLICY "usage_own" ON usage_logs FOR ALL USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

-- Promo codes: public read (for validation), admin write
CREATE POLICY "promo_read" ON promo_codes FOR SELECT USING (is_active = TRUE);
CREATE POLICY "promo_admin" ON promo_codes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

-- Exchange rates: public read
CREATE POLICY "rates_read" ON exchange_rates FOR SELECT USING (TRUE);
CREATE POLICY "rates_admin" ON exchange_rates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

-- ============================================================
-- Helper Functions
-- ============================================================

-- Consume a basic credit (subscription first, then PAYG)
CREATE OR REPLACE FUNCTION consume_basic_credit(p_user_id UUID, p_feature TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub RECORD;
  v_source TEXT;
BEGIN
  -- 1. Try active subscription credits
  SELECT * INTO v_sub FROM subscriptions
  WHERE user_id = p_user_id AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND AND v_sub.basic_credits_remaining > 0 THEN
    UPDATE subscriptions SET basic_credits_remaining = basic_credits_remaining - 1 WHERE id = v_sub.id;
    v_source := 'subscription';
  ELSE
    -- 2. Fall back to PAYG credits
    IF (SELECT payg_basic_credits FROM profiles WHERE id = p_user_id) > 0 THEN
      UPDATE profiles SET payg_basic_credits = payg_basic_credits - 1 WHERE id = p_user_id;
      v_source := 'payg';
    ELSE
      RETURN jsonb_build_object('success', FALSE, 'reason', 'no_credits');
    END IF;
  END IF;

  INSERT INTO usage_logs (user_id, subscription_id, request_type, credits_consumed, source, feature)
  VALUES (p_user_id, v_sub.id, 'basic', 1, v_source, p_feature);

  RETURN jsonb_build_object('success', TRUE, 'source', v_source);
END;
$$;

-- Consume an advanced credit
CREATE OR REPLACE FUNCTION consume_advanced_credit(p_user_id UUID, p_feature TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub RECORD;
  v_source TEXT;
BEGIN
  SELECT * INTO v_sub FROM subscriptions
  WHERE user_id = p_user_id AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND AND v_sub.advanced_credits_remaining > 0 THEN
    UPDATE subscriptions SET advanced_credits_remaining = advanced_credits_remaining - 1 WHERE id = v_sub.id;
    v_source := 'subscription';
  ELSE
    IF (SELECT payg_advanced_credits FROM profiles WHERE id = p_user_id) > 0 THEN
      UPDATE profiles SET payg_advanced_credits = payg_advanced_credits - 1 WHERE id = p_user_id;
      v_source := 'payg';
    ELSE
      RETURN jsonb_build_object('success', FALSE, 'reason', 'no_credits');
    END IF;
  END IF;

  INSERT INTO usage_logs (user_id, subscription_id, request_type, credits_consumed, source, feature)
  VALUES (p_user_id, v_sub.id, 'advanced', 1, v_source, p_feature);

  RETURN jsonb_build_object('success', TRUE, 'source', v_source);
END;
$$;

-- Get current credit balance for a user
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub RECORD;
  v_profile RECORD;
BEGIN
  SELECT basic_credits_remaining, advanced_credits_remaining INTO v_sub
  FROM subscriptions
  WHERE user_id = p_user_id AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC LIMIT 1;

  SELECT payg_basic_credits, payg_advanced_credits INTO v_profile
  FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'sub_basic',       COALESCE(v_sub.basic_credits_remaining, 0),
    'sub_advanced',    COALESCE(v_sub.advanced_credits_remaining, 0),
    'payg_basic',      COALESCE(v_profile.payg_basic_credits, 0),
    'payg_advanced',   COALESCE(v_profile.payg_advanced_credits, 0),
    'total_basic',     COALESCE(v_sub.basic_credits_remaining, 0) + COALESCE(v_profile.payg_basic_credits, 0),
    'total_advanced',  COALESCE(v_sub.advanced_credits_remaining, 0) + COALESCE(v_profile.payg_advanced_credits, 0)
  );
END;
$$;
