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

  return (
    <div className="space-y-1.5">
      {DAY_ORDER.map(day => {
        const d = value[day]
        return (
          <div key={day} className="flex items-center gap-3 py-1">
            <span className="text-sm w-24 shrink-0">{DAY_LABELS[day]}</span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <input type="checkbox" checked={d.closed} onChange={e => updateDay(day, { closed: e.target.checked })} />
              Fermé
            </label>
            {!d.closed && (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={d.open}
                  onChange={e => updateDay(day, { open: e.target.value })}
                  className="h-9 rounded-lg border border-input bg-background px-2 text-xs flex-1 min-w-0"
                />
                <span className="text-muted-foreground text-xs">à</span>
                <input
                  type="time"
                  value={d.close}
                  onChange={e => updateDay(day, { close: e.target.value })}
                  className="h-9 rounded-lg border border-input bg-background px-2 text-xs flex-1 min-w-0"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
