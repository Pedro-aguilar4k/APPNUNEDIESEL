import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function GaugeCard({
  title,
  description,
  value,
  footer,
}: {
  title: string
  description: string
  value: number // 0-100
  footer?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="hsl(var(--chart-1))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * c} ${c}`}
            />
          </svg>
          <span className="absolute text-3xl font-semibold tabular-nums text-foreground">{pct}%</span>
        </div>
        {footer ? <p className="text-center text-sm text-muted-foreground text-pretty">{footer}</p> : null}
      </CardContent>
    </Card>
  )
}
