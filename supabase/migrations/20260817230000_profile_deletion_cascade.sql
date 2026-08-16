-- Deleting a user from AdminUsers.tsx was failing with a 409 (FK violation)
-- for any real account, because every table referencing profiles(id) used
-- the Postgres default ON DELETE NO ACTION and the client only manually
-- cleared 3 of the 16 actual references (analyses/comparisons/negotiations).
-- This fixes it at the schema level so no future table can reintroduce the
-- same bug: personal records the user owns outright cascade away with them;
-- records that are really owned by someone/something else but merely
-- reference the user (an assigned agent, a quote's admin, a subscribed
-- business's owner login) are detached via SET NULL instead of destroyed;
-- and admin-managed operational data (ERP orders/clients/deliveries a staff
-- account manages) is deliberately left blocking, since silently wiping
-- live order/shipment history because a staff account got deleted would be
-- far worse than a clear error telling the admin to reassign it first.

-- profiles itself: deleting the underlying auth user should take the profile
-- (and everything below) with it — today it's NO ACTION, so deleting only
-- auth.users would itself be blocked by a still-existing profile row.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- Owned personal records — cascade
alter table public.analyses drop constraint analyses_user_id_fkey;
alter table public.analyses add constraint analyses_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.comparisons drop constraint comparisons_user_id_fkey;
alter table public.comparisons add constraint comparisons_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.negotiations drop constraint negotiations_user_id_fkey;
alter table public.negotiations add constraint negotiations_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.subscriptions drop constraint subscriptions_user_id_fkey;
alter table public.subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.payment_transactions drop constraint payment_transactions_user_id_fkey;
alter table public.payment_transactions add constraint payment_transactions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.usage_logs drop constraint usage_logs_user_id_fkey;
alter table public.usage_logs add constraint usage_logs_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.quote_requests drop constraint quote_requests_customer_id_fkey;
alter table public.quote_requests add constraint quote_requests_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete cascade;

-- Attribution on records that belong to something else — detach, don't destroy
alter table public.system_events drop constraint system_events_user_id_fkey;
alter table public.system_events add constraint system_events_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.quote_requests drop constraint quote_requests_quoted_by_fkey;
alter table public.quote_requests add constraint quote_requests_quoted_by_fkey
  foreign key (quoted_by) references public.profiles(id) on delete set null;

alter table public.whatsapp_conversations drop constraint whatsapp_conversations_assigned_to_fkey;
alter table public.whatsapp_conversations add constraint whatsapp_conversations_assigned_to_fkey
  foreign key (assigned_to) references public.profiles(id) on delete set null;

-- Deleting a business owner's login must never delete the business itself
-- (its subscription, WhatsApp number, conversations, FAQ) — only unlink them.
alter table public.assistant_clients drop constraint assistant_clients_profile_id_fkey;
alter table public.assistant_clients add constraint assistant_clients_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

alter table public.whatsapp_contacts drop constraint whatsapp_contacts_customer_profile_id_fkey;
alter table public.whatsapp_contacts add constraint whatsapp_contacts_customer_profile_id_fkey
  foreign key (customer_profile_id) references public.profiles(id) on delete set null;

-- The order itself (and its admin owner in erp_orders.user_id) stays; only the
-- specific customer link is nullable and safe to detach.
alter table public.erp_orders drop constraint erp_orders_customer_id_fkey;
alter table public.erp_orders add constraint erp_orders_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete set null;

-- erp_orders.user_id, erp_clients.user_id, erp_deliveries.user_id are left
-- untouched (still NO ACTION/blocking): these are NOT NULL admin-owned
-- operational records, so deleting a staff account that still manages live
-- orders/clients/deliveries correctly fails loudly instead of either
-- silently wiping real business data or leaving it orphaned.
