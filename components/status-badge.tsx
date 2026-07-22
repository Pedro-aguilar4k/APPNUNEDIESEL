import { Badge } from "@/components/ui/badge"

export function AtivoBadge({ ativo }: { ativo: boolean }) {
  if (ativo) {
    return (
      <Badge className="border border-success/30 bg-success/15 text-success hover:bg-success/15">
        Ativo
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      Inativo
    </Badge>
  )
}

const NOTA_STATUS: Record<string, { label: string; className: string }> = {
  pendente: { label: "Aguardando conferência", className: "border-warning/30 bg-warning/15 text-warning" },
  em_conferencia: { label: "Em conferência", className: "border-primary/30 bg-primary/10 text-primary" },
  conferida: { label: "Conferida", className: "border-success/30 bg-success/15 text-success" },
  divergente: { label: "Divergente", className: "border-destructive/30 bg-destructive/15 text-destructive" },
  reconhecida: { label: "Reconhecida", className: "border-success/30 bg-success/15 text-success" },
}

export function NotaStatusBadge({ status }: { status: string }) {
  const s = NOTA_STATUS[status] ?? NOTA_STATUS.pendente
  return <Badge className={`border ${s.className} hover:bg-transparent`}>{s.label}</Badge>
}

const ITEM_STATUS: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "border-warning/30 bg-warning/15 text-warning" },
  conferido: { label: "Conferido", className: "border-success/30 bg-success/15 text-success" },
  divergente: { label: "Divergente", className: "border-destructive/30 bg-destructive/15 text-destructive" },
  nao_encontrado: { label: "Sem produto", className: "border-muted bg-muted text-muted-foreground" },
}

export function ItemStatusBadge({ status }: { status: string }) {
  const s = ITEM_STATUS[status] ?? ITEM_STATUS.pendente
  return <Badge className={`border ${s.className} hover:bg-transparent`}>{s.label}</Badge>
}
