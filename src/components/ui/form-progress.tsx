interface FormProgressMilestones {
  start: string
  progress: string
  almost: string
  done: string
}

interface FormProgressProps {
  /** 0-100 */
  percent: number
  label?: string
  milestones?: FormProgressMilestones
}

const DEFAULT_MILESTONES: FormProgressMilestones = {
  start: 'Commencez ci-dessous',
  progress: 'Continuez comme ça',
  almost: 'Presque fini…',
  done: 'Prêt ! 🎉',
}

function milestoneText(percent: number, milestones: FormProgressMilestones): string {
  if (percent >= 100) return milestones.done
  if (percent >= 60) return milestones.almost
  if (percent > 0) return milestones.progress
  return milestones.start
}

/** Goal-gradient progress indicator — completing a form feels closer as it fills in. */
export function FormProgress({ percent, label = 'Progression', milestones = DEFAULT_MILESTONES }: FormProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {milestoneText(clamped, milestones)} · <span className="font-semibold text-primary">{Math.round(clamped)}%</span>
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
