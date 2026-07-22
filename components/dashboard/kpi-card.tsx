import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

export function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "bg-muted text-muted-foreground",
}: {
  label: string
  value: string | number
  sublabel?: string
  icon: LucideIcon
  tone?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {sublabel ? <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{sublabel}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
