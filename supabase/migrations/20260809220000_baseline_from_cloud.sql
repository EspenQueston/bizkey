-- Baseline migration reconstructed from the live BizKey (formerly AfriSourceAI) cloud project
-- (ref: tkntysncwoxyvqepfbal) via schema introspection on 2026-08-09.
--
-- The migration files previously in this directory (now under
-- supabase/migrations_legacy/) did not match the cloud project's actual
-- migration history (different names/timestamps) and are believed stale.
-- This file reflects the exact live schema: tables, columns, constraints,
-- indexes, functions, trigger, and RLS policies, as they exist in the cloud
-- database. All cloud tables contained 0 rows at pull time, so no data
-- migration was required.

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- =========================================================================
-- Tables
-- =========================================================================

create table public.profiles (
  id uuid primary key references auth.users(id),
  email varchar not null unique,
  name varchar,
  subscription_tier varchar default 'free'
    check (subscription_tier in ('free', 'basic', 'pro')),
  credits_remaining integer default 3,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_admin boolean not null default false,
  basic_credits_remaining integer not null default 3,
  advanced_credits_remaining integer not null default 0,
  payg_basic_credits integer not null default 0,
  payg_advanced_credits integer not null default 0,
  country text
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  type text not null check (type in ('subscription', 'payg')),
  price_yuan numeric not null default 0,
  price_usd numeric not null default 0,
  basic_credits integer not null default 0,
  advanced_credits integer not null default 0,
  duration_days integer,
  is_active boolean not null default true,
  is_beta boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  plan_id uuid not null references public.plans(id),
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled', 'pending')),
  basic_credits_remaining integer not null default 0,
  advanced_credits_remaining integer not null default 0,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  auto_renew boolean not null default true,
  payment_method text,
  created_at timestamptz not null default now()
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  plan_id uuid references public.plans(id),
  amount_local numeric not null default 0,
  currency text not null default 'XOF',
  amount_usd numeric,
  payment_method text,
  country_code text,
  phone_number text,
  gateway text not null default 'pending',
  gateway_transaction_id text,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'refunded')),
  webhook_received_at timestamptz,
  webhook_payload jsonb,
  created_at timestamptz not null default now()
);

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  subscription_id uuid references public.subscriptions(id),
  request_type text not null check (request_type in ('basic', 'advanced')),
  credits_consumed integer not null default 1,
  source text not null default 'subscription'
    check (source in ('subscription', 'payg')),
  feature text,
  response_time_ms integer,
  created_at timestamptz not null default now()
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null
    check (discount_type in ('percent', 'fixed_yuan', 'fixed_usd')),
  discount_value numeric not null,
  max_uses integer,
  used_count integer not null default 0,
  valid_until timestamptz,
  plan_ids uuid[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null default 'CNY',
  target_currency text not null,
  rate numeric not null,
  fetched_at timestamptz not null default now(),
  unique (base_currency, target_currency)
);

create table public.exchange_rate_cache (
  id uuid primary key default gen_random_uuid(),
  cny_to_xaf numeric not null,
  cny_to_usd numeric not null,
  usd_to_xaf numeric not null,
  fetched_at timestamptz not null default now()
);

create table public.analyses (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  product_url text not null,
  product_name text,
  supplier_name text,
  price numeric,
  moq integer,
  confidence_score integer check (confidence_score >= 0 and confidence_score <= 100),
  ai_analysis jsonb,
  raw_product_data jsonb,
  created_at timestamptz default now()
);

create table public.comparisons (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  analysis_ids uuid[],
  winner_analysis_id uuid references public.analyses(id),
  ai_recommendation text,
  created_at timestamptz default now()
);

create table public.negotiations (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  analysis_id uuid not null references public.analyses(id),
  target_price numeric,
  strategy jsonb,
  messages jsonb,
  created_at timestamptz default now()
);

-- NOTE: RLS is disabled on this table on the live cloud project too - this
-- is a known, flagged issue (anon/authenticated roles can read/write it
-- unrestricted). Reproduced as-is for local parity; see chat for remediation
-- options before enabling RLS with policies.
create table public.approved_admins (
  email text primary key,
  granted_by text default 'system',
  created_at timestamptz default now()
);

-- =========================================================================
-- Indexes (beyond those implied by primary key / unique constraints above)
-- =========================================================================

create index idx_analyses_created_at on public.analyses using btree (created_at desc);
create index idx_analyses_user_id on public.analyses using btree (user_id);
create index idx_comparisons_user_id on public.comparisons using btree (user_id);
create index idx_exchange_rate_cache_fetched on public.exchange_rate_cache using btree (fetched_at desc);
create index idx_negotiations_analysis_id on public.negotiations using btree (analysis_id);
create index idx_negotiations_user_id on public.negotiations using btree (user_id);

-- =========================================================================
-- Functions
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$declare
  v_is_admin boolean := false;
begin
  select exists (
    select 1 from public.approved_admins where email = new.email
  ) into v_is_admin;

  insert into public.profiles (id, email, name, country, subscription_tier, credits_remaining, basic_credits_remaining, advanced_credits_remaining, payg_basic_credits, payg_advanced_credits, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'country',
    'free',
    3,
    3,
    0,
    0,
    0,
    v_is_admin
  )
  on conflict (id) do update set
    email = excluded.email,
    country = coalesce(excluded.country, profiles.country),
    name = coalesce(excluded.name, profiles.name),
    is_admin = greatest(profiles.is_admin, excluded.is_admin);
  return new;
end;$function$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.decrement_credits(user_id uuid)
returns void
language plpgsql
security definer
as $function$
begin
  update public.profiles
  set credits_remaining = greatest(0, credits_remaining - 1)
  where id = user_id and subscription_tier = 'free';
end;
$function$;

create or replace function public.consume_basic_credit(p_user_id uuid, p_feature text default null::text)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_sub record;
  v_source text;
begin
  select * into v_sub from subscriptions
  where user_id = p_user_id and status = 'active'
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;

  if found and v_sub.basic_credits_remaining > 0 then
    update subscriptions set basic_credits_remaining = basic_credits_remaining - 1 where id = v_sub.id;
    v_source := 'subscription';
  else
    if (select payg_basic_credits from profiles where id = p_user_id) > 0 then
      update profiles set payg_basic_credits = payg_basic_credits - 1 where id = p_user_id;
      v_source := 'payg';
    else
      return jsonb_build_object('success', false, 'reason', 'no_credits');
    end if;
  end if;

  insert into usage_logs (user_id, subscription_id, request_type, credits_consumed, source, feature)
  values (p_user_id, v_sub.id, 'basic', 1, v_source, p_feature);

  return jsonb_build_object('success', true, 'source', v_source);
end;
$function$;

create or replace function public.consume_advanced_credit(p_user_id uuid, p_feature text default null::text)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_sub record;
  v_source text;
begin
  select * into v_sub from subscriptions
  where user_id = p_user_id and status = 'active'
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;

  if found and v_sub.advanced_credits_remaining > 0 then
    update subscriptions set advanced_credits_remaining = advanced_credits_remaining - 1 where id = v_sub.id;
    v_source := 'subscription';
  else
    if (select payg_advanced_credits from profiles where id = p_user_id) > 0 then
      update profiles set payg_advanced_credits = payg_advanced_credits - 1 where id = p_user_id;
      v_source := 'payg';
    else
      return jsonb_build_object('success', false, 'reason', 'no_credits');
    end if;
  end if;

  insert into usage_logs (user_id, subscription_id, request_type, credits_consumed, source, feature)
  values (p_user_id, v_sub.id, 'advanced', 1, v_source, p_feature);

  return jsonb_build_object('success', true, 'source', v_source);
end;
$function$;

create or replace function public.get_credit_balance(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_sub record;
  v_profile record;
begin
  select basic_credits_remaining, advanced_credits_remaining into v_sub
  from subscriptions
  where user_id = p_user_id and status = 'active'
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;

  select payg_basic_credits, payg_advanced_credits into v_profile
  from profiles where id = p_user_id;

  return jsonb_build_object(
    'sub_basic',       coalesce(v_sub.basic_credits_remaining, 0),
    'sub_advanced',    coalesce(v_sub.advanced_credits_remaining, 0),
    'payg_basic',      coalesce(v_profile.payg_basic_credits, 0),
    'payg_advanced',   coalesce(v_profile.payg_advanced_credits, 0),
    'total_basic',     coalesce(v_sub.basic_credits_remaining, 0) + coalesce(v_profile.payg_basic_credits, 0),
    'total_advanced',  coalesce(v_sub.advanced_credits_remaining, 0) + coalesce(v_profile.payg_advanced_credits, 0)
  );
end;
$function$;

create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_name text default null::text,
  p_subscription_tier text default 'free'::text,
  p_is_admin boolean default false,
  p_basic_credits integer default 3,
  p_country text default null::text
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_result json;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Unauthorized: admin only';
  end if;

  select id into v_user_id
  from auth.users
  where email = p_email;

  if v_user_id is not null then
    raise exception 'Email already exists';
  end if;

  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role
  ) values (
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name),
    false,
    'authenticated'
  )
  returning id into v_user_id;

  update public.profiles set
    name = p_name,
    subscription_tier = p_subscription_tier,
    is_admin = p_is_admin,
    basic_credits_remaining = p_basic_credits,
    credits_remaining = p_basic_credits,
    country = p_country,
    updated_at = now()
  where id = v_user_id;

  select json_build_object(
    'id', v_user_id,
    'email', p_email,
    'name', p_name
  ) into v_result;

  return v_result;
end;
$function$;

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.comparisons enable row level security;
alter table public.negotiations enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.usage_logs enable row level security;
alter table public.promo_codes enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.exchange_rate_cache enable row level security;
-- public.approved_admins intentionally left without RLS to mirror the
-- current (flagged) cloud state - see note on the table definition above.

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles
  for select using (auth.uid() = id or exists (
    select 1 from public.profiles p2 where p2.id = auth.uid() and p2.is_admin = true
  ));
create policy "Admins can update all profiles" on public.profiles
  for update using (auth.uid() = id or exists (
    select 1 from public.profiles p2 where p2.id = auth.uid() and p2.is_admin = true
  ));
create policy "Admins can delete profiles" on public.profiles
  for delete using (exists (
    select 1 from public.profiles p2 where p2.id = auth.uid() and p2.is_admin = true
  ));

create policy "Users can view own analyses" on public.analyses
  for select using (auth.uid() = user_id);
create policy "Users can insert own analyses" on public.analyses
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own analyses" on public.analyses
  for delete using (auth.uid() = user_id);

create policy "Users can view own comparisons" on public.comparisons
  for select using (auth.uid() = user_id);
create policy "Users can insert own comparisons" on public.comparisons
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own comparisons" on public.comparisons
  for delete using (auth.uid() = user_id);

create policy "Users can view own negotiations" on public.negotiations
  for select using (auth.uid() = user_id);
create policy "Users can insert own negotiations" on public.negotiations
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own negotiations" on public.negotiations
  for delete using (auth.uid() = user_id);

create policy "plans_read_all" on public.plans
  for select using (true);
create policy "plans_admin_write" on public.plans
  for all using (exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true
  ));

create policy "subscriptions_own" on public.subscriptions
  for all using (auth.uid() = user_id or exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true
  ));

create policy "transactions_own" on public.payment_transactions
  for all using (auth.uid() = user_id or exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true
  ));

create policy "usage_own" on public.usage_logs
  for all using (auth.uid() = user_id or exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true
  ));

create policy "promo_read" on public.promo_codes
  for select using (is_active = true);
create policy "promo_admin" on public.promo_codes
  for all using (exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true
  ));

create policy "rates_read" on public.exchange_rates
  for select using (true);
create policy "rates_admin" on public.exchange_rates
  for all using (exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true
  ));

create policy "Public read exchange rates" on public.exchange_rate_cache
  for select using (true);
create policy "Service role write exchange rates" on public.exchange_rate_cache
  for all using (auth.role() = 'service_role'::text);
