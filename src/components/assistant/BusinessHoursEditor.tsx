export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export interface DayHours { open: string; close: string; closed: boolean }
export type BusinessHours = Record<DayKey, DayHours>

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche',
}
export const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function defaultHours(): BusinessHours {
  return DAY_ORDER.reduce((acc, day) => {
    acc[day] = { open: '09:00', close: '18:00', closed: day === 'sun' }
    return acc
  }, {} as BusinessHours)
}

export function normalizeHours(raw: Record<string, unknown> | null): BusinessHours {
  const base = defaultHours()
  if (!raw) return base
  for (const day of DAY_ORDER) {
    const entry = raw[day] as Partial<DayHours> | undefined
    if (entry) {
      base[day] = {
        open: typeof entry.open === 'string' ? entry.open : base[day].open,
        close: typeof entry.close === 'string' ? entry.close : base[day].close,
        closed: typeof entry.closed === 'boolean' ? entry.closed : base[day].closed,
      }
    }
  }
  return base
}

export function BusinessHoursEditor({ value, onChange }: { value: BusinessHours; onChange: (hours: BusinessHours) => void }) {
  function updateDay(day: DayKey, patch: Partial<DayHours>) {
    onChange({ ...value, [day]: { ...value[day], ...patch } })
  }

  // Each day gets its own vertical slot — a native <input type="time">
  // renders a fixed HH:MM (or AM/PM) spinner UI with a real minimum width;
  // squeezing two of them onto the same line as the day name AND a "Fermé"
  // checkbox (as a single-column layout, or worse, a 2-column day grid)
  // starves them below that minimum and the browser just clips the digits,
  // leaving what looks like an empty box. Stacking the time row below the
  // day/checkbox row keeps the 2-column density without that trade-off.
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {DAY_ORDER.map(day => {
        const d = value[day]
        return (
          <div key={day} className="rounded-lg border border-border/60 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 cursor-pointer">
                <input type="checkbox" checked={d.closed} onChange={e => updateDay(day, { closed: e.target.checked })} />
                Fermé
              </label>
            </div>
            {!d.closed && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={d.open}
                  onChange={e => updateDay(day, { open: e.target.value })}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs flex-1 min-w-[92px]"
                />
                <span className="text-muted-foreground text-xs shrink-0">à</span>
                <input
                  type="time"
                  value={d.close}
                  onChange={e => updateDay(day, { close: e.target.value })}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs flex-1 min-w-[92px]"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
