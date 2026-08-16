-- BizKey WhatsApp Assistant <-> n8n bridge (phase 1: assistant only —
-- text/audio support + parcel-tracking images. Sourcing image search
-- (1688/Onebound, credits) is explicitly deferred to a later migration.
--
-- Adds what the n8n workflow needs beyond the existing whatsapp_conversations
-- / whatsapp_messages tables: event-level dedup (a webhook must never be
-- processed twice), a customer-identification table keyed by E.164 number
-- (provisional until linked to a real BizKey account), and message-level
-- fields for type/intent/tracking that the workflow's "Edit Fields" nodes
-- already produce.

create table public.whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider_message_id text,
  event_type text not null check (event_type in ('inbound', 'outbound')),
  created_at timestamptz not null default now()
);

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  whatsapp_number text not null unique,
  display_name text,
  -- Linked once the customer confirms their identity (OTP/activation link).
  -- Null means "provisional" — a real conversation exists but nobody has
  -- claimed it as their BizKey account yet.
  customer_profile_id uuid references public.profiles(id),
  is_provisional boolean not null default true,
  activation_token text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_conversations
  add column if not exists contact_id uuid references public.whatsapp_contacts(id);

alter table public.whatsapp_messages
  add column if not exists provider_message_id text unique,
  add column if not exists message_type text check (message_type in ('text', 'audio', 'image')),
  add column if not exists image_intent text check (image_intent in ('parcel', 'product', 'unknown')),
  add column if not exists tracking_number text,
  add column if not exists carrier text,
  add column if not exists media_url text,
  add column if not exists ai_cost numeric;

create index idx_whatsapp_contacts_number on public.whatsapp_contacts using btree (whatsapp_number);
create index idx_whatsapp_conversations_contact_id on public.whatsapp_conversations using btree (contact_id);

alter table public.whatsapp_events enable row level security;
alter table public.whatsapp_contacts enable row level security;

create policy "whatsapp_events_admin" on public.whatsapp_events for all using (public.is_admin());
create policy "whatsapp_contacts_admin" on public.whatsapp_contacts for all using (public.is_admin());
