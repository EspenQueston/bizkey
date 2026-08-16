-- BizKey Assistant: WhatsApp Business automation tooling. Admin-owned for
-- this first build (BizKey manages its own WhatsApp presence for sourcing
-- leads/support), not yet a per-client self-service product — matches how
-- the admin panel's nav is being split into "BizKey Sourcing" vs "BizKey
-- WhatsApp Assistant" today. No live WhatsApp Business API account exists
-- yet, so this is the full data model + rule engine, ready to receive real
-- webhook traffic once credentials are available; conversations/messages
-- can be seeded today via the built-in simulator for testing.

create table public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  phone_number text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  business_account_id text,
  created_at timestamptz not null default now()
);

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  number_id uuid references public.whatsapp_numbers(id),
  customer_phone text not null,
  customer_name text,
  status text not null default 'open' check (status in ('open', 'pending_human', 'closed')),
  last_message_at timestamptz not null default now(),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'bot', 'agent')),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.whatsapp_kb_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  keywords text[] not null default '{}',
  answer text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_auto_replies (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('greeting', 'keyword', 'fallback')),
  trigger_value text,
  kb_article_id uuid references public.whatsapp_kb_articles(id),
  response_text text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_whatsapp_conversations_number_id on public.whatsapp_conversations using btree (number_id);
create index idx_whatsapp_conversations_status on public.whatsapp_conversations using btree (status);
create index idx_whatsapp_messages_conversation_id on public.whatsapp_messages using btree (conversation_id);
create index idx_whatsapp_auto_replies_sort on public.whatsapp_auto_replies using btree (sort_order);

-- Admin-only across the board — this is internal BizKey tooling, not
-- exposed to sourcing customers.
alter table public.whatsapp_numbers enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_kb_articles enable row level security;
alter table public.whatsapp_auto_replies enable row level security;

create policy "whatsapp_numbers_admin" on public.whatsapp_numbers for all using (public.is_admin());
create policy "whatsapp_conversations_admin" on public.whatsapp_conversations for all using (public.is_admin());
create policy "whatsapp_messages_admin" on public.whatsapp_messages for all using (public.is_admin());
create policy "whatsapp_kb_articles_admin" on public.whatsapp_kb_articles for all using (public.is_admin());
create policy "whatsapp_auto_replies_admin" on public.whatsapp_auto_replies for all using (public.is_admin());
