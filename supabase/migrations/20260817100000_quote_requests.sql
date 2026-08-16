-- Client-facing quote-request workflow: a customer asks for a price on a
-- product, an admin reviews and quotes it, the customer accepts and pays.
-- This is the first real authenticated-customer link the ERP module gets —
-- deliberately separate from erp_clients (the admin's manual CRM contact
-- book for people without logins) and from erp_orders.client_id (which
-- points at erp_clients, not at profiles).

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  analysis_id uuid references public.analyses(id),
  product_name text not null,
  product_url text,
  product_image_url text,
  quantity integer not null default 1,
  target_price_cny numeric,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'quoted', 'accepted', 'rejected', 'expired')),
  quoted_unit_price numeric,
  quoted_currency text,
  quoted_total numeric,
  admin_notes text,
  quoted_by uuid references public.profiles(id),
  quoted_at timestamptz,
  erp_order_id uuid references public.erp_orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quote_requests_customer_id on public.quote_requests using btree (customer_id);
create index idx_quote_requests_status on public.quote_requests using btree (status);

-- ── erp_orders gets a real customer link (nullable — existing staff-created
--    orders with no linked login stay null) ────────────────────────────────
alter table public.erp_orders add column if not exists customer_id uuid references public.profiles(id);
create index if not exists idx_erp_orders_customer_id on public.erp_orders using btree (customer_id);

-- ── payment_transactions gets a quote link, mirroring the existing
--    nullable plan_id column exactly ────────────────────────────────────────
alter table public.payment_transactions add column if not exists quote_request_id uuid references public.quote_requests(id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.quote_requests enable row level security;

create policy "quote_requests_select" on public.quote_requests
  for select using (auth.uid() = customer_id or public.is_admin());

-- Client can only ever insert a 'pending' row for themselves — defense in
-- depth against a client posting a pre-quoted price via a crafted payload.
create policy "quote_requests_insert" on public.quote_requests
  for insert with check (auth.uid() = customer_id and status = 'pending');

create policy "quote_requests_admin_write" on public.quote_requests
  for update using (public.is_admin());
create policy "quote_requests_admin_delete" on public.quote_requests
  for delete using (public.is_admin());

-- New read-only policies on erp_orders/erp_deliveries — additive, so the
-- existing "erp_orders_own"/"erp_deliveries_own" `for all` policies (which
-- gate the admin's own write access) are never touched. A client can only
-- ever gain read access this way, never write/delete access to their order.
create policy "erp_orders_customer_read" on public.erp_orders
  for select using (auth.uid() = customer_id);

create policy "erp_deliveries_customer_read" on public.erp_deliveries
  for select using (
    exists (
      select 1 from public.erp_orders o
      where o.id = erp_deliveries.order_id and o.customer_id = auth.uid()
    )
  );

-- ── RPCs ─────────────────────────────────────────────────────────────────
-- RLS can't express "client may flip status but never touch quoted_unit_price",
-- so client state transitions go through SECURITY DEFINER RPCs instead —
-- same pattern already used for consume_basic_credit/consume_advanced_credit.

create or replace function public.respond_to_quote_request(p_quote_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quote_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      updated_at = now()
  where id = p_quote_id and customer_id = auth.uid() and status = 'quoted';

  if not found then
    raise exception 'Quote not found, not yours, or not awaiting a response';
  end if;
end;
$$;

-- Re-derives payment truth server-side rather than trusting the client: the
-- client has no write access to erp_orders.is_paid, so this is the only way
-- a quote-linked order gets marked paid, and it only does so after checking
-- a real successful payment_transactions row exists for that quote.
create or replace function public.mark_quote_order_paid(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  select erp_order_id into v_order_id from public.quote_requests
  where id = p_quote_id and customer_id = auth.uid();

  if v_order_id is null then
    raise exception 'No linked order for this quote';
  end if;

  if not exists (
    select 1 from public.payment_transactions
    where quote_request_id = p_quote_id and status = 'success'
  ) then
    raise exception 'No successful payment found for this quote';
  end if;

  update public.erp_orders set is_paid = true, status = 'confirmed', updated_at = now()
  where id = v_order_id;
end;
$$;
