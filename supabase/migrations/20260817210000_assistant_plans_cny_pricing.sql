-- Switches assistant_plans to CNY-denominated pricing (matching how
-- BizKey Sourcing's own `plans` table already prices in price_yuan, per
-- the user's new pricing table: Starter 199¥, Business 499¥, Pro 799¥+).
-- Replaces the 3 previously-seeded USD/XOF plans entirely — no real paying
-- Assistant customers exist yet, so this is a straight swap, not additive.

alter table public.assistant_plans
  add column if not exists price_yuan numeric not null default 0;

-- UPDATE-in-place via upsert rather than delete+insert: existing demo/test
-- assistant_clients rows may already reference these plan ids by FK.
insert into public.assistant_plans (name, display_name, price_yuan, price_usd, price_xof, max_numbers, max_conversations_per_month, features, is_popular, sort_order) values
  ('assistant_starter', 'Starter', 199, 28, 17300, 1, 500,
    '["1 numéro WhatsApp", "FAQ & réponses simples", "Transfert vers un agent humain", "Messages mensuels limités"]'::jsonb,
    false, 1),
  ('assistant_business', 'Business', 499, 70, 43300, 1, 2500,
    '["Catalogue produits & horaires", "FAQ avancée", "Tableau de bord & rapports", "Disponible en français ou anglais", "Messages mensuels limités"]'::jsonb,
    true, 2),
  ('assistant_pro', 'Pro', 799, 112, 69400, 1, 10000,
    '["Plusieurs scénarios de conversation", "Intégration CRM / WooCommerce", "Gestion d''équipe", "Analytics avancés", "Suivi de colis import/export", "Multilingue (3+ langues)", "Support prioritaire", "Messages mensuels limités"]'::jsonb,
    false, 3)
on conflict (name) do update set
  display_name = excluded.display_name,
  price_yuan = excluded.price_yuan,
  price_usd = excluded.price_usd,
  price_xof = excluded.price_xof,
  max_numbers = excluded.max_numbers,
  max_conversations_per_month = excluded.max_conversations_per_month,
  features = excluded.features,
  is_popular = excluded.is_popular,
  sort_order = excluded.sort_order;
