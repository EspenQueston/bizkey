-- Links ERP orders to the real payment methods the platform proposes
-- (per-country mobile money via FedaPay — see
-- src/lib/payment/config/payment_methods.json) so the Livraisons page can
-- reflect actual payment state instead of static placeholder data.

alter table public.erp_orders
  add column if not exists payment_method text,
  add column if not exists is_paid boolean not null default false;

comment on column public.erp_orders.payment_method is
  'Method id from payment_methods.json (e.g. mtn_bj, orange_ci, wave_sn) or null if unset.';
comment on column public.erp_orders.is_paid is
  'Whether payment has been confirmed for this order — gates dispatch in the Livraisons workflow.';
