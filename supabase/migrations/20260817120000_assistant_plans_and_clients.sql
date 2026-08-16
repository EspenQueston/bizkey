-- BizKey WhatsApp Assistant's own commercial layer: plans (public-readable,
-- shown on the dual-product Pricing page) and clients (admin-managed CRM
-- contact book, mirroring erp_clients' pattern rather than a full
-- self-service account model — matches BizKey Assistant being admin-owned
-- tooling for now, same as the rest of this product domain).

create table public.assistant_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  price_usd numeric not null default 0,
  price_xof numeric not null default 0,
  max_numbers integer not null default 1,
  max_conversations_per_month integer not null default 500,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_popular boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.assistant_clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended', 'cancelled')),
  plan_id uuid references public.assistant_plans(id),
  whatsapp_number_id uuid references public.whatsapp_numbers(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assistant_clients_plan_id on public.assistant_clients using btree (plan_id);
create index idx_assistant_clients_status on public.assistant_clients using btree (status);

alter table public.assistant_plans enable row level security;
alter table public.assistant_clients enable row level security;

create policy "assistant_plans_read_all" on public.assistant_plans
  for select using (true);
create policy "assistant_plans_admin_write" on public.assistant_plans
  for all using (public.is_admin());

create policy "assistant_clients_admin" on public.assistant_clients
  for all using (public.is_admin());

insert into public.assistant_plans (name, display_name, price_usd, price_xof, max_numbers, max_conversations_per_month, features, is_popular, sort_order) values
  ('assistant_starter', 'Starter', 19, 12000, 1, 500,
    '["1 numéro WhatsApp Business", "500 conversations / mois", "Réponses automatiques & FAQ", "Transfert vers un agent humain"]'::jsonb,
    false, 1),
  ('assistant_pro', 'Pro', 49, 30000, 3, 2500,
    '["3 numéros WhatsApp Business", "2 500 conversations / mois", "Base de connaissances illimitée", "Rapports de performance", "Transfert humain prioritaire"]'::jsonb,
    true, 2),
  ('assistant_business', 'Business', 99, 62000, 10, 10000,
    '["10 numéros WhatsApp Business", "10 000 conversations / mois", "Intégration Evolution API dédiée", "Rapports avancés & export", "Support prioritaire"]'::jsonb,
    false, 3)
on conflict (name) do nothing;
