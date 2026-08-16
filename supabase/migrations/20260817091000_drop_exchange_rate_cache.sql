-- exchange_rate_cache backed the standalone `exchange-rates` edge function
-- (live-fetched CNY→XAF/USD rates, hardcoded to XAF regardless of the user's
-- actual country). AnalysisResult.tsx now reads from the shared
-- `exchange_rates` table like the rest of the app, so this table and its
-- writer have no remaining consumer.
drop table if exists public.exchange_rate_cache;
