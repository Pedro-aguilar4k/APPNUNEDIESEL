"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Clock, Search, Send, Hourglass, Inbox, Package, CalendarDays, User } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  GARANTIA_STATUS,
  GARANTIA_STATUS_LABELS,
  type Garantia,
  type GarantiaStatus,
} from "@/lib/garantias"
import { atualizarStatusGarantia, atualizarAnaliseGarantia } from "@/app/actions/garantias"

type StatusConfig = {
  description: string
  icon: LucideIcon
  accent: string
  badge: string
  dot: string
}

const STATUS_CONFIG: Record<GarantiaStatus, StatusConfig> = {
  pendente: {
    description: "Aguardando triagem",
    icon: Clock,
    accent: "border-t-amber-500",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  em_analise: {
    description: "Sendo avaliado",
    icon: Search,
    accent: "border-t-sky-500",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  enviado: {
    description: "Enviado ao fornecedor",
    icon: Send,
    accent: "border-t-violet-500",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  esperando_retorno: {
    description: "Aguardando o fornecedor",
    icon: Hourglass,
    accent: "border-t-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR")
}

export function GarantiaBoard({ garantias: initial = [] }: { garantias?: Garantia[] }) {
  const [items, setItems] = useState<Garantia[]>(initial)
  const [selected, setSelected] = useState<Garantia | null>(null)

  function patchLocal(updated: Garantia) {
    setItems((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    setSelected((cur) => (cur && cur.id === updated.id ? updated : cur))
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GARANTIA_STATUS.map((status) => {
          const cfg = STATUS_CONFIG[status]
          const StatusIcon = cfg.icon
          const doStatus = items.filter((t) => t.status === status)
          return (
            <div key={status} className="flex flex-col gap-3">
              <div
                className={cn("flex items-center justify-between rounded-lg border border-t-4 bg-card p-3", cfg.accent)}
              >
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{GARANTIA_STATUS_LABELS[status]}</p>
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
                  doStatus.map((t) => (
                    <TicketCard key={t.id} ticket={t} dot={cfg.dot} onOpen={() => setSelected(t)} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <GarantiaDetailDialog
        garantia={selected}
        onClose={() => setSelected(null)}
        onPatch={patchLocal}
      />
    </>
  )
}

function TicketCard({ ticket, dot, onOpen }: { ticket: Garantia; dot: string; onOpen: () => void }) {
  return (
    <Card
      className="flex cursor-pointer flex-col gap-2 p-4 transition-colors hover:border-primary/40"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden="true" />
          {ticket.protocolo}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          {fmtDate(ticket.createdAt)}
        </span>
      </div>

      <div className="flex items-start gap-2">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground text-pretty">{ticket.produtoDescricao}</p>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">Cliente: {ticket.clienteNome}</p>

      <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
        {ticket.vendedorNome && (
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3 w-3" aria-hidden="true" />
            {ticket.vendedorNome}
          </span>
        )}
      </div>
    </Card>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-pretty">{value}</span>
    </div>
  )
}

function GarantiaDetailDialog({
  garantia,
  onClose,
  onPatch,
}: {
  garantia: Garantia | null
  onClose: () => void
  onPatch: (g: Garantia) => void
}) {
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingAnalise, setSavingAnalise] = useState(false)
  const [analise, setAnalise] = useState("")
  const [resultado, setResultado] = useState<string>("nenhum")
  const [obs, setObs] = useState("")

  // Sincroniza os campos internos quando um ticket é aberto.
  const [lastId, setLastId] = useState<number | null>(null)
  if (garantia && garantia.id !== lastId) {
    setLastId(garantia.id)
    setAnalise(garantia.analiseTecnica ?? "")
    setResultado(garantia.resultado ?? "nenhum")
    setObs(garantia.observacaoInterna ?? "")
  }

  async function onChangeStatus(next: string) {
    if (!garantia) return
    setSavingStatus(true)
    const res = await atualizarStatusGarantia(garantia.id, next as GarantiaStatus)
    setSavingStatus(false)
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao mover ticket.")
      return
    }
    onPatch({ ...garantia, status: next as GarantiaStatus })
    toast.success(`Status atualizado para "${GARANTIA_STATUS_LABELS[next as GarantiaStatus]}".`)
  }

  async function onSalvarAnalise() {
    if (!garantia) return
    setSavingAnalise(true)
    const res = await atualizarAnaliseGarantia(garantia.id, {
      analiseTecnica: analise,
      resultado: resultado === "nenhum" ? null : resultado,
      observacaoInterna: obs,
    })
    setSavingAnalise(false)
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao salvar análise.")
      return
    }
    onPatch({
      ...garantia,
      analiseTecnica: analise || null,
      resultado: resultado === "nenhum" ? null : resultado,
      observacaoInterna: obs || null,
    })
    toast.success("Análise interna salva.")
  }

  return (
    <Dialog open={!!garantia} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {garantia && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{garantia.protocolo}</span>
              </DialogTitle>
              <DialogDescription>
                Aberta por {garantia.vendedorNome ?? "—"} em {fmtDate(garantia.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5">
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={garantia.status} onValueChange={onChangeStatus} disabled={savingStatus}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GARANTIA_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {GARANTIA_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <p className="col-span-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados do cliente
                </p>
                <Field label="Nome / Razão social" value={garantia.clienteNome} />
                <Field label="Contato" value={garantia.clienteContato} />
                <Field label="Fone / Celular" value={garantia.clienteFone} />
                <Field label="E-mail" value={garantia.clienteEmail} />
                <Field label="Nº da nota fiscal" value={garantia.notaNumero} />
                <Field label="Data da compra" value={garantia.dataCompra} />
                <Field label="Loja" value={garantia.loja} />
              </section>

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <p className="col-span-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados do produto
                </p>
                <Field label="Nº da peça" value={garantia.pecaNumero} />
                <Field label="Descrição da peça" value={garantia.produtoDescricao} />
                <Field label="Marca da peça" value={garantia.pecaMarca} />
                <Field label="Veículo" value={garantia.veiculo} />
                <Field label="Ano / Modelo" value={garantia.anoModelo} />
                <Field label="Motor" value={garantia.motor} />
              </section>

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <p className="col-span-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Informações de uso
                </p>
                <Field label="Km inicial" value={garantia.kmInicial} />
                <Field label="Km na data do defeito" value={garantia.kmDefeito} />
                <Field label="Km rodado" value={garantia.kmRodado} />
                <Field label="Horas rodadas" value={garantia.horasRodadas} />
                <Field label="Data da aplicação" value={garantia.dataAplicacao} />
                <Field label="Data do defeito" value={garantia.dataDefeito} />
              </section>

              <section className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Descrição do defeito
                </p>
                <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground text-pretty">
                  {garantia.descricaoDefeito}
                </p>
              </section>

              {/* Uso interno */}
              <section className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Uso interno — Nune Diesel
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="analise">Análise técnica</Label>
                  <Textarea
                    id="analise"
                    rows={3}
                    value={analise}
                    onChange={(e) => setAnalise(e.target.value)}
                    placeholder="Parecer técnico sobre a peça..."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Resultado</Label>
                  <Select value={resultado} onValueChange={setResultado}>
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Não definido</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="reprovado">Reprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="obs">Observações</Label>
                  <Input id="obs" value={obs} onChange={(e) => setObs(e.target.value)} />
                </div>
                <div>
                  <Button onClick={onSalvarAnalise} disabled={savingAnalise}>
                    {savingAnalise ? "Salvando..." : "Salvar análise"}
                  </Button>
                </div>
              </section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
