"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  GARANTIA_STATUS_LABELS,
  type Garantia,
  type GarantiaStatus,
} from "@/app/actions/garantias"
import { ShieldCheck, Package, CalendarDays, User, Inbox } from "lucide-react"

const STATUS_STYLE: Record<GarantiaStatus, { badge: string; dot: string }> = {
  pendente: { badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  em_analise: { badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
  enviado: { badge: "bg-violet-500/15 text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  esperando_retorno: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR")
}

function statusStyle(s: string) {
  return STATUS_STYLE[s as GarantiaStatus] ?? STATUS_STYLE.pendente
}

function statusLabel(s: string) {
  return GARANTIA_STATUS_LABELS[s as GarantiaStatus] ?? s
}

export function MinhasGarantiasList({ garantias }: { garantias: Garantia[] }) {
  const [aberta, setAberta] = useState<Garantia | null>(null)

  if (garantias.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Nenhuma garantia aberta</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
            Use o botão &quot;Abrir garantia&quot; para registrar uma nova solicitação.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {garantias.map((g) => {
          const st = statusStyle(g.status)
          return (
            <Card
              key={g.id}
              className="flex cursor-pointer flex-col gap-2 p-4 transition-colors hover:bg-accent/50"
              onClick={() => setAberta(g)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setAberta(g)
                }
              }}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", st.dot)} aria-hidden="true" />
                  {g.protocolo}
                </span>
                <Badge className={st.badge}>{statusLabel(g.status)}</Badge>
              </div>
              <div className="flex items-start gap-2">
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground text-pretty">{g.produtoDescricao}</p>
              </div>
              <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3 w-3" aria-hidden="true" />
                  {g.clienteNome}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  {fmtDate(g.createdAt)}
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      <GarantiaDetalhe garantia={aberta} onClose={() => setAberta(null)} />
    </>
  )
}

function Linha({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground text-pretty">{value}</dd>
    </div>
  )
}

function GarantiaDetalhe({ garantia, onClose }: { garantia: Garantia | null; onClose: () => void }) {
  const g = garantia
  return (
    <Dialog open={!!g} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {g && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="font-mono">{g.protocolo}</span>
                <Badge className={statusStyle(g.status).badge}>{statusLabel(g.status)}</Badge>
              </DialogTitle>
              <DialogDescription>Aberta em {fmtDate(g.createdAt)}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados do cliente
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Linha label="Nome / Razão Social" value={g.clienteNome} />
                  <Linha label="Contato" value={g.clienteContato} />
                  <Linha label="Fone / Celular" value={g.clienteFone} />
                  <Linha label="E-mail" value={g.clienteEmail} />
                  <Linha label="Nº Nota Fiscal" value={g.notaNumero} />
                  <Linha label="Data da Compra" value={g.dataCompra} />
                  <Linha label="Loja" value={g.loja} />
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados do produto
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Linha label="Nº da Peça" value={g.pecaNumero} />
                  <Linha label="Descrição" value={g.produtoDescricao} />
                  <Linha label="Marca" value={g.pecaMarca} />
                  <Linha label="Veículo" value={g.veiculo} />
                  <Linha label="Ano / Modelo" value={g.anoModelo} />
                  <Linha label="Motor" value={g.motor} />
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Informações de uso
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Linha label="Km Inicial" value={g.kmInicial} />
                  <Linha label="Km na Data do Defeito" value={g.kmDefeito} />
                  <Linha label="Km Rodado" value={g.kmRodado} />
                  <Linha label="Horas Rodadas" value={g.horasRodadas} />
                  <Linha label="Data da Aplicação" value={g.dataAplicacao} />
                  <Linha label="Data do Defeito" value={g.dataDefeito} />
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Defeito apresentado
                </h3>
                <p className="text-sm text-foreground text-pretty">{g.descricaoDefeito}</p>
              </section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
