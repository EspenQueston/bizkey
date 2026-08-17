-- Deleting an order that originated from a quote request currently fails
-- with a raw FK violation instead of anything an admin could act on. A
-- quote_request is an "attributed" record, not an "owned" one, per the same
-- reasoning already applied to erp_orders.customer_id and assistant_clients
-- deletion: the historical record of what a customer asked for and was
-- quoted should survive the order being deleted — it just loses the link.
alter table public.quote_requests drop constraint quote_requests_erp_order_id_fkey;
alter table public.quote_requests add constraint quote_requests_erp_order_id_fkey
  foreign key (erp_order_id) references public.erp_orders(id) on delete set null;
