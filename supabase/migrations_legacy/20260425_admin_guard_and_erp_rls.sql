-- ============================================================
-- BizKey — Admin Guard + ERP RLS Hardening
-- ============================================================

-- 1) Harden admin profile updates: only admins can update is_admin
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile without admin flag" ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin = (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid())
);

-- 2) Ensure erp tables have RLS enabled
ALTER TABLE IF EXISTS erp_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS erp_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS erp_deliveries ENABLE ROW LEVEL SECURITY;

-- 3) Remove legacy policies if present
DROP POLICY IF EXISTS "erp_clients_owner_or_admin" ON erp_clients;
DROP POLICY IF EXISTS "erp_orders_owner_or_admin" ON erp_orders;
DROP POLICY IF EXISTS "erp_deliveries_owner_or_admin" ON erp_deliveries;

-- 4) Strict owner-or-admin access policies
CREATE POLICY "erp_clients_owner_or_admin" ON erp_clients
FOR ALL
USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
)
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

CREATE POLICY "erp_orders_owner_or_admin" ON erp_orders
FOR ALL
USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
)
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);

CREATE POLICY "erp_deliveries_owner_or_admin" ON erp_deliveries
FOR ALL
USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
)
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);
