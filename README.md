# BizKey

BizKey is a sourcing and import-assistance web app for francophone African merchants who buy from Chinese marketplaces such as 1688, Alibaba, Taobao, Tmall, and AliExpress.

The app combines:

- AI product analysis from marketplace URLs.
- Supplier trust scoring and negotiation guidance.
- A protected user dashboard with analysis history.
- Pricing, checkout, and Mobile Money payment flows.
- Admin/ERP screens for plans, transactions, customers, orders, deliveries, and analytics.
- Supabase Edge Functions for AI analysis, comparison, negotiation, and payment gateway access.

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Supabase Auth, Postgres, Row Level Security, and Edge Functions
- shadcn/ui components
- Tailwind CSS 4
- lucide-react icons
- FedaPay and Stripe provider abstractions (CinetPay removed for now — see below)

## Repository Layout

```text
.
├── public/                         Static public assets
├── src/
│   ├── components/                 Shared app and shadcn/ui components
│   ├── contexts/AuthContext.tsx    Auth/session/profile provider
│   ├── hooks/                      App hooks
│   ├── lib/
│   │   ├── api.ts                  Edge Function API wrappers
│   │   ├── db.ts                   Supabase table/RPC helpers
│   │   ├── payment/                Payment provider strategy layer
│   │   └── supabase.ts             Browser Supabase client and DB types
│   └── pages/                      Public, dashboard, admin, ERP pages
├── supabase/
│   ├── config.toml                 Supabase project/function config
│   ├── functions/                  Edge Functions
│   └── migrations/                 Database migrations
├── .env.example                    Browser env template
└── package.json
```

## Main Routes

- `/` — public landing page
- `/pricing` — public pricing page
- `/login` — sign in/sign up
- `/checkout` — protected payment checkout
- `/dashboard` — protected dashboard home
- `/dashboard/pricing` — protected dashboard pricing and recharge page
- `/analyze` — protected product analysis page
- `/analysis/:id` — protected analysis result page
- `/compare` — protected comparison page
- `/negotiate` — protected negotiation page
- `/profile` — protected profile page
- `/settings` — protected settings page
- `/erp-panel` — unified admin and ERP panel

## Environment Variables

Create a local `.env` file from `.env.example`.

```bash
cp .env.example .env
```

Required browser variables:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_PAYMENT_PROVIDER=fedapay
```

Edge Function secrets are not used by the browser. Configure them in Supabase or create `supabase/functions/.env` locally from `supabase/functions/.env.example` when serving functions locally.

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
ONEBOUND_KEY=your-onebound-key
ONEBOUND_SECRET=your-onebound-secret
FEDAPAY_API_KEY=your-fedapay-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key
```

Never commit real `.env` files. They are intentionally ignored by git.

## Environment Process (Dev / Staging / Prod)

- **Development**
  - Frontend uses `.env` from `.env.example`.
  - Local Supabase function secrets can be loaded from `supabase/functions/.env`.
  - Use sandbox payment credentials only.

- **Staging**
  - Use a dedicated Supabase project and separate payment sandbox keys.
  - Deploy via `supabase db push` + functions deploy to staging.
  - Validate full checkout flow before production release.

- **Production**
  - Secrets configured only in Supabase project settings / secure CI variables.
  - No secret files committed in repository.
  - Production keys never reused in development or staging.

### Pre-release Configuration Checklist

- [ ] `VITE_SUPABASE_URL` points to correct environment project
- [ ] `VITE_SUPABASE_ANON_KEY` is valid and not disabled
- [ ] Payment function secrets set (`FEDAPAY_API_KEY`, `STRIPE_SECRET_KEY`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only configured server-side
- [ ] No `.env.local` or `supabase/functions/.env` tracked in git
- [ ] Migrations applied to target environment
- [ ] Payment methods marked active in `payment_methods.json` match deployed provider credentials

## Local Development

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run TypeScript checks only:

```bash
npm run typecheck
```

Run credit RPC validation (requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TEST_USER_ID`):

```bash
npm run test:credits
```

Preview the production build:

```bash
npm run preview
```

## Supabase Setup

1. Create or link a Supabase project.
2. Apply migrations from `supabase/migrations`.
3. Configure Auth email/password providers as needed.
4. Configure Edge Function secrets.
5. Deploy Edge Functions.

Typical commands:

```bash
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy analyze
supabase functions deploy analyze-free
supabase functions deploy compare
supabase functions deploy negotiate
supabase functions deploy payment
```

The current `supabase/config.toml` includes:

```toml
[functions.analyze-free]
verify_jwt = false
```

All other functions are expected to receive an authenticated Supabase user JWT.

## Edge Functions

### `analyze`

Protected product analysis endpoint used by `/analyze`.

Flow:

1. Verifies the Supabase user JWT.
2. Loads the user profile.
3. Checks free-tier credits with the newer credit fields.
4. Extracts product data from marketplace URLs when provider credentials are available.
5. Falls back to deterministic product data when scraping or AI providers fail.
6. Generates an AI report with OpenAI when configured.
7. Saves the analysis to `analyses`.
8. Consumes one free basic credit for free-tier users.

The function is defensive by design: provider timeouts, invalid AI JSON, unavailable Onebound credentials, and OpenAI errors should not produce a generic 500 for normal analysis requests.

### `analyze-free`

Public free-analysis endpoint used by the landing-page free tool. It can analyze a URL or image and uses IP-based rate limiting when the rate-limit table exists.

### `compare`

Protected endpoint that compares two or more saved analyses and stores the comparison.

### `negotiate`

Protected endpoint that creates a negotiation strategy for a saved analysis.

### `payment`

Protected endpoint that keeps payment gateway credentials server-side. Browser code calls this function with the signed-in user's access token.

Observability and quality notes:

- `analyze` and `payment` emit structured operational events into `system_events` (status, service, latency, source, metadata).
- `analyses` stores `data_source`, `ai_source`, `quality_tier`, and `fallback_reason` to monitor Onebound/OpenAI fallback quality.
- Admin panel includes IA quality view at `/erp-panel/ai-quality` for fallback case tracking.

Supported provider abstractions:

- FedaPay
- Stripe

CinetPay support was removed (for now). `VITE_PAYMENT_PROVIDER` defaults to `fedapay`.

## Payment Flow

Pricing entry points:

- Public pricing page: `/pricing`
- Dashboard pricing page: `/dashboard/pricing`
- Upgrade links from the dashboard, profile page, and exhausted-credit modal

All paid plan buttons route to:

```text
/checkout?plan=<plan_name>
```

Checkout flow:

1. User selects or arrives with a plan.
2. User selects country.
3. User selects a payment method.
4. User enters a Mobile Money phone number.
5. Browser calls the protected `payment` Edge Function with the user JWT.
6. The Edge Function initiates the gateway payment.
7. The app stores a pending transaction in `payment_transactions`.
8. The checkout polls the same Edge Function for payment status.

The payment provider code lives in `src/lib/payment/providers`. Shared authenticated calls are handled by `src/lib/payment/callPaymentFunction.ts`.

## Database Notes

Important tables from the migrations:

- `profiles`
- `plans`
- `subscriptions`
- `payment_transactions`
- `usage_logs`
- `promo_codes`
- `exchange_rates`
- `analyses`
- `comparisons`
- `negotiations`
- ERP tables for clients, orders, and deliveries

Important RPC helpers:

- `consume_basic_credit`
- `consume_advanced_credit`
- `get_credit_balance`

Credit source of truth (official):

- **V2 model is authoritative**: `basic_credits_remaining`, `advanced_credits_remaining`, `payg_basic_credits`, `payg_advanced_credits`.
- `credits_remaining` is now **legacy/deprecated compatibility only** and synchronized from V2 for safe rollback windows.
- Migration `20260425_credit_observability_quality.sql` sets `credit_model_version = 'v2'` and keeps legacy sync during transition.

## Pricing Plans

Plans are loaded dynamically from the `plans` table. Default seeded plans include:

- `free`
- `standard`
- `payg_starter`
- `payg_standard`
- `payg_boost`
- `payg_pro`

Plan display details can be customized with the `metadata` JSONB column:

```json
{
  "features": ["Analyse produit IA", "Score fournisseur", "Support prioritaire"],
  "description": "Forfait mensuel pour vendeurs actifs",
  "icon_name": "Crown",
  "is_popular": true,
  "cta_label": "Choisir Standard"
}
```

## Troubleshooting

### Analyze page returns 500

Check the deployed `analyze` Edge Function first:

```bash
supabase functions logs analyze
```

Common causes:

- Function secrets are missing.
- The deployed function is older than the local code.
- The database schema has not received the latest migrations.
- The user profile does not exist.
- The `analyses` table insert is failing.

The current function falls back when Onebound or OpenAI fails, so provider failures should be logged but should not break the user flow.

### Payment fails immediately

Verify:

- The user is signed in.
- The browser sends a user access token, not the anon key.
- FedaPay/Stripe secrets are configured on the Edge Function.
- The selected payment method is marked `active` in `payment_methods.json`.
- The `payment_transactions` table exists and RLS policies are applied.

### Plans do not appear

Verify:

- `plans` table exists.
- Seed data has been applied.
- RLS policy `plans_read_all` exists.
- `is_active` is `true` for the plans you expect to show.

## Deployment

Build the frontend:

```bash
npm run build
```

Deploy the frontend to your chosen host, then configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYMENT_PROVIDER`

Deploy Supabase database and functions separately:

```bash
supabase db push
supabase functions deploy analyze
supabase functions deploy analyze-free
supabase functions deploy compare
supabase functions deploy negotiate
supabase functions deploy payment
```

## License

No license has been selected yet. Add a `LICENSE` file before making this repository public if external reuse is intended.
