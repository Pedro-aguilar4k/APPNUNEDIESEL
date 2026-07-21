"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Clock, Search, Send, Hourglass, Inbox, Building2, Package, CalendarDays } from "lucide-react"
import type { LucideIcon } from "lucide-react"

// Status do fluxo de garantia. A ordem aqui define a ordem das colunas.
export const GARANTIA_STATUS = ["pendente", "em_analise", "enviado", "esperando_retorno"] as const
export type GarantiaStatus = (typeof GARANTIA_STATUS)[number]

type StatusConfig = {
  label: string
  description: string
  icon: LucideIcon
  // Classes de acento da coluna (borda superior + textos/badges).
  accent: string
  badge: string
  dot: string
}

const STATUS_CONFIG: Record<GarantiaStatus, StatusConfig> = {
  pendente: {
    label: "Pendente",
    description: "Aguardando triagem",
    icon: Clock,
    accent: "border-t-amber-500",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  em_analise: {
    label: "Em análise",
    description: "Sendo avaliado",
    icon: Search,
    accent: "border-t-sky-500",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  enviado: {
    label: "Enviado",
    description: "Enviado ao fornecedor",
    icon: Send,
    accent: "border-t-violet-500",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  esperando_retorno: {
    label: "Esperando retorno",
    description: "Aguardando o fornecedor",
    icon: Hourglass,
    accent: "border-t-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
}

export type GarantiaTicket = {
  id: number
  protocolo: string
  produto: string
  fornecedor: string | null
  solicitante: string | null
  motivo: string | null
  status: GarantiaStatus
  criadoEm: string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR")
}

export function GarantiaBoard({ tickets = [] }: { tickets?: GarantiaTicket[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {GARANTIA_STATUS.map((status) => {
        const cfg = STATUS_CONFIG[status]
        const StatusIcon = cfg.icon
        const doStatus = tickets.filter((t) => t.status === status)
        return (
          <div key={status} className="flex flex-col gap-3">
            <div className={cn("flex items-center justify-between rounded-lg border border-t-4 bg-card p-3", cfg.accent)}>
              <div className="flex items-center gap-2">
                <StatusIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                  <p className="text-xs text-muted-foreground">{cfg.description}</p>
                </div>
              </div>
              <Badge className={cn("tabular-nums", cfg.badge)}>{doStatus.length}</Badge>
            </div>

            <div className="flex flex-col gap-3">
              {doStatus.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
                  <Inbox className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" />
                  <p className="px-4 text-xs text-muted-foreground text-pretty">Nenhum ticket neste status.</p>
                </div>
              ) : (
                doStatus.map((t) => <TicketCard key={t.id} ticket={t} dot={cfg.dot} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TicketCard({ ticket, dot }: { ticket: GarantiaTicket; dot: string }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden="true" />
          {ticket.protocolo}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          {fmtDate(ticket.criadoEm)}
        </span>
      </div>

      <div className="flex items-start gap-2">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground text-pretty">{ticket.produto}</p>
      </div>

      {ticket.motivo && <p className="text-xs text-muted-foreground text-pretty">{ticket.motivo}</p>}

      <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
        {ticket.fornecedor && (
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3 w-3" aria-hidden="true" />
            {ticket.fornecedor}
          </span>
        )}
        {ticket.solicitante && <span>Solicitante: {ticket.solicitante}</span>}
      </div>
    </Card>
  )
}
