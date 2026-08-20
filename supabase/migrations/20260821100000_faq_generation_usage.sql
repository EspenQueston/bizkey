-- Widens usage_events to also cover AI FAQ-generation calls (the new
-- generate-faq-from-document edge function), so that cost shows up in the
-- exact same "Coût IA" totals AssistantBilling.tsx / WhatsAppOverview.tsx
-- already display — get_usage_summary sums across every event_type, so no
-- frontend change is needed for the new type to appear.

alter table public.usage_events
  drop constraint usage_events_event_type_check,
  add constraint usage_events_event_type_check check (event_type in ('message_inbound', 'message_outbound', 'faq_generation'));
