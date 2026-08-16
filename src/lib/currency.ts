export const SUPPORTED_CURRENCIES = ['CNY', 'XOF', 'XAF', 'USD', 'EUR'] as const
export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

export const CURRENCY_LABELS: Record<Currency, string> = {
  CNY: '¥ Yuan (CNY)',
  XOF: 'FCFA (XOF)',
  XAF: 'FCFA (XAF)',
  USD: '$ USD',
  EUR: '€ EUR',
}

/** Used until live rates load from `exchange_rates`, and as a last-resort fallback if that fetch fails. */
export const DEFAULT_RATE_FALLBACK: Record<string, number> = {
  CNY_XOF: 90,
  CNY_XAF: 90,
  CNY_USD: 0.14,
  CNY_EUR: 0.128,
  USD_XOF: 620,
  USD_XAF: 620,
  USD_EUR: 0.92,
}

function rate(rates: Record<string, number>, base: string, target: Currency): number {
  if (target === base) return 1
  return rates[`${base}_${target}`] ?? DEFAULT_RATE_FALLBACK[`${base}_${target}`] ?? 0
}

/** Convert a CNY amount into `target`, rounded the way each currency is normally displayed (whole units for FCFA/CNY, cents for USD/EUR). */
export function convertFromCny(cny: number, target: Currency, rates: Record<string, number>): number {
  if (target === 'CNY') return cny
  const r = rate(rates, 'CNY', target)
  const converted = cny * r
  return target === 'USD' || target === 'EUR' ? Math.round(converted * 100) / 100 : Math.round(converted)
}

/** Format a CNY amount as a currency string in `target` (e.g. "12 400 FCFA", "$17.36", "¥230"). */
export function formatCurrencyFromCny(cny: number, target: Currency, rates: Record<string, number>): string {
  if (cny === 0) return 'Gratuit'
  const amount = convertFromCny(cny, target, rates)
  if (target === 'CNY') return `¥${amount}`
  if (target === 'USD') return `$${amount.toFixed(2)}`
  if (target === 'EUR') return `${amount.toFixed(2)} €`
  return `${amount.toLocaleString('fr-FR')} FCFA`
}
