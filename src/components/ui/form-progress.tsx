interface FormProgressProps {
  /** 0-100 */
  percent: number
  label?: string
}

function milestoneText(percent: number): string {
  if (percent >= 100) return 'Prêt ! 🎉'
  if (percent >= 60) return 'Presque fini…'
  if (percent > 0) return 'Continuez comme ça'
  return 'Commencez ci-dessous'
}

/** Goal-gradient progress indicator — completing a form feels closer as it fills in. */
export function FormProgress({ percent, label = 'Progression' }: FormProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {milestoneText(clamped)} · <span className="font-semibold text-primary">{Math.round(clamped)}%</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
