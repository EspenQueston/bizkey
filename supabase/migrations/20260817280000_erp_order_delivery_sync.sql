-- Order management and delivery were two fully independent state machines
-- with zero synchronization: advancing a delivery to "delivered" left the
-- order's own status wherever it was (e.g. stuck at "confirmed"), and there
-- was no DB-level guarantee they'd ever agree — every "sync" depended on an
-- admin remembering to click two separate buttons on two separate pages.
-- This makes the delivery the single source of truth for shipping-stage
-- progress: any change to a delivery's status is trigger-synced onto its
-- order immediately, in the same transaction, regardless of which client
-- made the change — the actual meaning of "synchronous" here.

-- "returned" already existed as a real delivery outcome but had nowhere to
-- go on the order side (only 'cancelled' existed, which means something
-- different — an order that was returned actually shipped and came back).
alter table public.erp_orders drop constraint erp_orders_status_check;
alter table public.erp_orders add constraint erp_orders_status_check
  check (status = any (array['draft','confirmed','in_production','shipped','in_transit','customs','delivered','cancelled','returned']));

-- A delivery with no order is meaningless data — deleting the order should
-- take its delivery with it rather than blocking (or worse, being silently
-- swallowed by a bare console.error, which is what the UI did before).
alter table public.erp_deliveries drop constraint erp_deliveries_order_id_fkey;
alter table public.erp_deliveries add constraint erp_deliveries_order_id_fkey
  foreign key (order_id) references public.erp_orders(id) on delete cascade;

-- One delivery per order — the creation UI had no dedup protection at all,
-- so nothing stopped two delivery rows silently existing for the same order.
alter table public.erp_deliveries add constraint erp_deliveries_order_id_unique unique (order_id);

alter table public.erp_deliveries add column if not exists updated_at timestamptz not null default now();

create or replace function public.sync_order_status_from_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new_status text;
begin
  v_new_status := case new.status
    when 'dispatched' then 'shipped'
    when 'in_transit' then 'in_transit'
    when 'customs' then 'customs'
    when 'delivered' then 'delivered'
    when 'returned' then 'returned'
    else null -- 'pending' carries no forward-progress signal for the order
  end;

  if v_new_status is not null then
    update public.erp_orders
    set status = v_new_status, updated_at = now()
    where id = new.order_id and status <> 'cancelled';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_order_status_from_delivery on public.erp_deliveries;
create trigger trg_sync_order_status_from_delivery
  after insert or update of status on public.erp_deliveries
  for each row execute function public.sync_order_status_from_delivery();
