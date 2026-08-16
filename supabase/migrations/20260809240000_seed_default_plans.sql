-- Seeds the default plan catalog and starting exchange rates.
--
-- The cloud project's `plans` table was empty (0 rows) at pull time, which is
-- why the Pricing page rendered with nothing to show. The plan set and
-- pricing below matches the one referenced by the legacy migration
-- (supabase/migrations_legacy/20260424_pricing_payment.sql) and the README's
-- "Default seeded plans" list; the `metadata` JSONB is new, populated with
-- feature lists / CTA labels the Pricing page (src/pages/Pricing.tsx) reads.

insert into public.plans
  (name, display_name, type, price_yuan, price_usd, basic_credits, advanced_credits, duration_days, sort_order, metadata)
values
  (
    'free', 'Gratuit', 'subscription', 0, 0, 5, 0, 30, 0,
    '{
      "description": "Découvrez la plateforme avec 5 analyses gratuites.",
      "icon_name": "Sparkles",
      "is_popular": false,
      "cta_label": "Commencer gratuitement",
      "cta_variant": "outline",
      "features": ["5 crédits Basic offerts", "Analyse produit IA", "Score de confiance fournisseur"],
      "excluded_features": ["Crédits Advanced", "Support prioritaire"]
    }'::jsonb
  ),
  (
    'standard', 'Standard', 'subscription', 72, 9.9, 150, 20, 30, 1,
    '{
      "description": "Formule mensuelle pour vendeurs actifs.",
      "icon_name": "Crown",
      "is_popular": true,
      "cta_label": "Choisir Standard",
      "cta_variant": "default",
      "features": ["150 crédits Basic/mois", "20 crédits Advanced/mois", "Score fournisseur détaillé", "Stratégie de négociation IA", "Support prioritaire"]
    }'::jsonb
  ),
  (
    'payg_starter', 'Starter PAYG', 'payg', 5, 0.7, 3, 0, null, 10,
    '{
      "description": "Petit pack pour tester le service à la carte.",
      "icon_name": "Package",
      "is_popular": false,
      "tag_color": "bg-secondary text-secondary-foreground"
    }'::jsonb
  ),
  (
    'payg_standard', 'Standard PAYG', 'payg', 15, 2.1, 10, 0, null, 11,
    '{
      "description": "Le pack le plus équilibré pour un usage régulier.",
      "icon_name": "Package",
      "is_popular": true,
      "tag_color": "bg-primary/15 text-primary"
    }'::jsonb
  ),
  (
    'payg_boost', 'Boost PAYG', 'payg', 25, 3.5, 12, 3, null, 12,
    '{
      "description": "Ajoutez des crédits Advanced à votre recharge.",
      "icon_name": "Zap",
      "is_popular": false,
      "tag_color": "bg-purple-100 text-purple-700"
    }'::jsonb
  ),
  (
    'payg_pro', 'Pro PAYG', 'payg', 50, 7.0, 18, 7, null, 13,
    '{
      "description": "Le plus gros pack à la carte, pour les gros volumes.",
      "icon_name": "Crown",
      "is_popular": false,
      "tag_color": "bg-purple-100 text-purple-700"
    }'::jsonb
  )
on conflict (name) do nothing;

insert into public.exchange_rates (base_currency, target_currency, rate) values
  ('CNY', 'XOF', 90.0),
  ('CNY', 'XAF', 90.0),
  ('CNY', 'USD', 0.14),
  ('USD', 'XOF', 620.0),
  ('USD', 'XAF', 620.0)
on conflict (base_currency, target_currency) do nothing;
