interface Props {
  icon: React.FC<{ className?: string }>
  title: string
  hint?: string
  height?: number
}

/**
 * Placeholder shown instead of a chart when there is genuinely no data.
 *
 * Rendering an axis grid with nothing plotted reads as a broken widget; saying
 * "no data yet, here's what will appear" reads as a working product that is
 * simply empty.
 */
export function ChartEmpty({ icon: Icon, title, hint, height = 200 }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border bg-muted/30 px-6"
      style={{ height }}
    >
      <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>}
    </div>
  )
}
