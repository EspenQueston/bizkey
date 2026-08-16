-- Cache table for exchange rates (updated hourly by edge function)
create table if not exists public.exchange_rate_cache (
  id          uuid primary key default gen_random_uuid(),
  cny_to_xaf  numeric(12,4) not null,
  cny_to_usd  numeric(12,6) not null,
  usd_to_xaf  numeric(12,4) not null,
  fetched_at  timestamptz not null default now()
);

-- Only service role can write; anon can read
alter table public.exchange_rate_cache enable row level security;

create policy "Public read exchange rates"
  on public.exchange_rate_cache for select
  using (true);

create policy "Service role write exchange rates"
  on public.exchange_rate_cache for all
  using (auth.role() = 'service_role');

-- Index for fast latest-row lookup
create index if not exists idx_exchange_rate_cache_fetched
  on public.exchange_rate_cache (fetched_at desc);
