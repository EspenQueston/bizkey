import type { AssistantTone } from '@/lib/supabase'

export const TONE_META: Record<AssistantTone, { label: string; description: string; emoji: string }> = {
  professional: { label: 'Professionnel', description: 'Formel, précis, orienté efficacité.', emoji: '💼' },
  friendly:     { label: 'Chaleureux',     description: 'Convivial et proche du client.',       emoji: '😊' },
  commercial:   { label: 'Commercial',     description: 'Met en avant offres et ventes.',        emoji: '🚀' },
}

export function ToneSelector({ value, onChange }: { value: AssistantTone; onChange: (tone: AssistantTone) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(TONE_META) as AssistantTone[]).map(t => {
        const meta = TONE_META[t]
        const active = value === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`text-left rounded-xl border-2 p-3 transition-all ${
              active ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10' : 'border-border hover:border-primary/40'
            }`}
          >
            <span className="text-lg">{meta.emoji}</span>
            <p className="text-sm font-semibold mt-1">{meta.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
          </button>
        )
      })}
    </div>
  )
}
