import { TrendingDown, TrendingUp, Minus, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  label: string
  /** Raw metric value. */
  value: number
  unit?: string
  /** Value at or beyond which the metric is considered unhealthy. */
  threshold: number
  /** true when *lower* is healthier (error rates, latency). */
  lowerIsBetter?: boolean
  /** Upper bound of the gauge. Defaults to 2x threshold. */
  max?: number
  hint?: string
}

/**
 * A rate/health metric shown against its own threshold.
 *
 * A bare "42.86%" tells an operator nothing — they can't know whether that is
 * normal or an incident. Pairing the number with its target, a position gauge
 * and a pass/fail colour makes the value self-explanatory at a glance.
 */
export function HealthStat({
  label, value, unit = '', threshold, lowerIsBetter = true, max, hint,
}: Props) {
  const healthy = lowerIsBetter ? value < threshold : value >= threshold
  const ceiling = max ?? Math.max(threshold * 2, value * 1.15, 1)
  const pct = Math.max(2, Math.min(100, (value / ceiling) * 100))
  const thresholdPct = Math.max(0, Math.min(100, (threshold / ceiling) * 100))

  const Trend = value === 0 ? Minus : lowerIsBetter ? TrendingDown : TrendingUp

  return (
    <Card className={`relative overflow-hidden transition-shadow duration-300 hover:shadow-lg ${
      healthy ? 'hover:border-emerald-500/50' : 'border-rose-500/40 hover:border-rose-500/60'
    }`}>
      {/* Health is legible from the card edge before reading a single number */}
      <span className={`absolute inset-x-0 top-0 h-1 ${
        healthy
          ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
          : 'bg-gradient-to-r from-rose-400 to-red-600'
      }`} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span
            className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 text-white ${
              healthy
                ? 'bg-gradient-to-r from-emerald-700 to-teal-600 shadow-sm shadow-emerald-600/40'
                : 'bg-gradient-to-r from-rose-700 to-red-600 shadow-sm shadow-rose-600/40'
            }`}
          >
            {healthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {healthy ? 'Normal' : 'À surveiller'}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-bold tabular-nums ${
            healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {Number.isInteger(value) ? value : value.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
          <Trend className={`h-3.5 w-3.5 ml-auto ${healthy ? 'text-emerald-500' : 'text-destructive'}`} />
        </div>

        {/* Position of the current value relative to its threshold marker */}
        <div className="relative mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              healthy
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                : 'bg-gradient-to-r from-rose-400 to-red-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="relative h-3 mt-0.5">
          <span
            className="absolute -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap"
            style={{ left: `${thresholdPct}%` }}
          >
            ▲ seuil {threshold}{unit}
          </span>
        </div>

        {hint && <p className="text-xs text-muted-foreground mt-2 leading-snug">{hint}</p>}
      </CardContent>
    </Card>
  )
}
