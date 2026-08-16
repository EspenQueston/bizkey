insert into public.exchange_rates (base_currency, target_currency, rate) values
  ('CNY', 'EUR', 0.128),
  ('USD', 'EUR', 0.92)
on conflict (base_currency, target_currency) do nothing;
