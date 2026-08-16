-- Fixes 4 real bugs found while auditing the Analyze/Compare/Negotiate/
-- Checkout features end-to-end against the live local stack:
--
-- 1. erp_clients, erp_orders, erp_deliveries don't exist at all, even though
--    src/lib/db.ts and the ERP pages (Clients/Orders/Delivery) already query
--    them by name — the entire ERP module 404s, in production too, since
--    this was pulled faithfully from the cloud schema. Added to match the
--    exact row shape the frontend types (ERPClient/ERPOrder/ERPDelivery)
--    expect (src/lib/supabase.ts).
-- 2. system_events doesn't exist, so every analyze/payment request's
--    logSystemEvent() call silently no-ops, and the admin dashboard's
--    getAdminStats() query 404s trying to read it.
-- 3. analyses is missing data_source/ai_source/quality_tier/fallback_reason,
--    so the primary insert in the analyze function always falls through to
--    its legacy-payload fallback (silently — by design — but the columns
--    still need to exist), and the admin AI-quality dashboard 400s trying
--    to select them.
-- 4. payment_transactions/subscriptions/usage_logs all had user_id
--    referencing auth.users(id) instead of public.profiles(id), unlike
--    every other user-owned table (analyses/comparisons/negotiations).
--    PostgREST can't resolve the `profiles(email, name)` embedded selects
--    the admin pages use (getAllTransactions/getAllSubscriptions in
--    src/lib/db.ts) without a direct FK to profiles, so those queries 400
--    with "could not find a relationship".

-- ── 1. Missing analyses columns ────────────────────────────────────────────

alter table public.analyses
  add column if not exists data_source text,
  add column if not exists ai_source text,
  add column if not exists quality_tier text,
  add column if not exists fallback_reason text;

-- ── 2. system_events ────────────────────────────────────────────────────────

create table public.system_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  event_name text not null,
  service text not null,
  status text not null check (status in ('ok', 'warn', 'error')),
  latency_ms integer,
  source text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_system_events_created_at on public.system_events using btree (created_at desc);
create index idx_system_events_service on public.system_events using btree (service);

alter table public.system_events enable row level security;

create policy "system_events_admin_read" on public.system_events
  for select using (public.is_admin());
create policy "system_events_service_write" on public.system_events
  for insert with check (auth.role() = 'service_role');

-- ── 3. ERP tables (erp_clients -> erp_orders -> erp_deliveries) ────────────

create table public.erp_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  name text not null,
  email text,
  phone text,
  country text not null,
  city text,
  company text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive', 'prospect')),
  created_at timestamptz not null default now()
);

create table public.erp_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  client_id uuid references public.erp_clients(id),
  order_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'in_production', 'shipped', 'in_transit', 'customs', 'delivered', 'cancelled')),
  product_name text not null,
  product_url text,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  currency text not null default 'XOF',
  total_amount numeric not null default 0,
  supplier_name text,
  destination_country text not null,
  destination_city text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.erp_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.erp_orders(id),
  user_id uuid not null references public.profiles(id),
  tracking_number text,
  carrier text,
  status text not null default 'pending'
    check (status in ('pending', 'dispatched', 'in_transit', 'customs', 'delivered', 'returned')),
  origin_country text not null default 'China',
  destination_country text not null,
  destination_city text,
  estimated_days integer,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_erp_clients_user_id on public.erp_clients using btree (user_id);
create index idx_erp_orders_user_id on public.erp_orders using btree (user_id);
create index idx_erp_orders_client_id on public.erp_orders using btree (client_id);
create index idx_erp_deliveries_user_id on public.erp_deliveries using btree (user_id);
create index idx_erp_deliveries_order_id on public.erp_deliveries using btree (order_id);

alter table public.erp_clients enable row level security;
alter table public.erp_orders enable row level security;
alter table public.erp_deliveries enable row level security;

create policy "erp_clients_own" on public.erp_clients
  for all using (auth.uid() = user_id or public.is_admin());
create policy "erp_orders_own" on public.erp_orders
  for all using (auth.uid() = user_id or public.is_admin());
create policy "erp_deliveries_own" on public.erp_deliveries
  for all using (auth.uid() = user_id or public.is_admin());

-- ── 4. Point user_id FKs at profiles instead of auth.users ─────────────────
-- (matches analyses/comparisons/negotiations, and unblocks the
-- profiles(email, name) / plans(display_name, type) embedded selects the
-- admin pages already rely on)

alter table public.payment_transactions drop constraint payment_transactions_user_id_fkey;
alter table public.payment_transactions add constraint payment_transactions_user_id_fkey
  foreign key (user_id) references public.profiles(id);

alter table public.subscriptions drop constraint subscriptions_user_id_fkey;
alter table public.subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references public.profiles(id);

alter table public.usage_logs drop constraint usage_logs_user_id_fkey;
alter table public.usage_logs add constraint usage_logs_user_id_fkey
  foreign key (user_id) references public.profiles(id);

-- ── Grants (RLS above is the real row-level gate; see prior migration) ─────

grant select, insert, update, delete on public.system_events, public.erp_clients, public.erp_orders, public.erp_deliveries
  to anon, authenticated;
grant all on public.system_events, public.erp_clients, public.erp_orders, public.erp_deliveries
  to service_role;
