import { Construction } from "lucide-react"

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 text-center">
      <Construction className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <p className="mt-4 text-lg font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">Esta etapa está sendo construída.</p>
    </div>
  )
}
