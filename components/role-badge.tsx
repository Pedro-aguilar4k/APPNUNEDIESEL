import { Badge } from "@/components/ui/badge"
import { ROLE_LABELS, type Role } from "@/lib/permissions"

const ROLE_STYLES: Record<Role, string> = {
  admin: "bg-primary text-primary-foreground",
  gerente: "bg-accent-brand text-accent-brand-foreground",
  comprador: "bg-chart-2/15 text-chart-2 border border-chart-2/30",
  estoquista: "bg-muted text-muted-foreground",
  vendedor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
}

export function RoleBadge({ role }: { role: string }) {
  const key = (role in ROLE_LABELS ? role : "estoquista") as Role
  return <Badge className={ROLE_STYLES[key]}>{ROLE_LABELS[key]}</Badge>
}
