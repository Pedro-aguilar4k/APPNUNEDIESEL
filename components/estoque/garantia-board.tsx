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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Clock,
  Search,
  Send,
  Hourglass,
  Inbox,
  Package,
  CalendarDays,
  User,
  CheckCircle2,
  Check,
  X,
  ArrowRight,
  Truck,
  Loader2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  GARANTIA_STATUS,
  GARANTIA_STATUS_LABELS,
  FRETE_CONTA,
  FRETE_CONTA_LABELS,
  PROCEDENCIA,
  PROCEDENCIA_LABELS,
  TIPO_RETORNO,
  TIPO_RETORNO_LABELS,
  type Garantia,
  type GarantiaStatus,
} from "@/lib/garantias"
import {
  aprovarTriagemGarantia,
  validarPrazoGarantia,
  cadastrarEnvioGarantia,
  avancarEtapaGarantia,
  registrarRetornoGarantia,
  rejeitarGarantia,
} from "@/app/actions/garantias"

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
    description: "Validar prazo",
    icon: Search,
    accent: "border-t-sky-500",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  enviado: {
    description: "NFG e transportadora",
    icon: Send,
    accent: "border-t-violet-500",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  esperando_retorno: {
    description: "Aguardando o fornecedor",
    icon: Hourglass,
    accent: "border-t-orange-500",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  concluido: {
    description: "Finalizada",
    icon: CheckCircle2,
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
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Sempre lê o item atual da lista para refletir os patches sem duplicar estado.
  const selected = items.find((g) => g.id === selectedId) ?? null

  function patchLocal(updated: Garantia) {
    setItems((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
  }

  function removeLocal(id: number) {
    setItems((prev) => prev.filter((g) => g.id !== id))
    setSelectedId(null)
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                    <TicketCard key={t.id} ticket={t} dot={cfg.dot} onOpen={() => setSelectedId(t.id)} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <GarantiaDetailDialog
        garantia={selected}
        onClose={() => setSelectedId(null)}
        onPatch={patchLocal}
        onRemove={removeLocal}
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
  onRemove,
}: {
  garantia: Garantia | null
  onClose: () => void
  onPatch: (g: Garantia) => void
  onRemove: (id: number) => void
}) {
  return (
    <Dialog open={!!garantia} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {garantia && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{garantia.protocolo}</span>
                <Badge className={cn(STATUS_CONFIG[garantia.status as GarantiaStatus]?.badge)}>
                  {GARANTIA_STATUS_LABELS[garantia.status as GarantiaStatus]}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Aberta por {garantia.vendedorNome ?? "—"} em {fmtDate(garantia.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5">
              {/* Ações da etapa atual */}
              <EtapaActions garantia={garantia} onPatch={onPatch} onRemove={onRemove} />

              <DadosGarantia garantia={garantia} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Bloco de ações que muda conforme o status do ticket. */
function EtapaActions({
  garantia,
  onPatch,
  onRemove,
}: {
  garantia: Garantia
  onPatch: (g: Garantia) => void
  onRemove: (id: number) => void
}) {
  const [loading, setLoading] = useState(false)
  const [rejeitarOpen, setRejeitarOpen] = useState(false)

  // Campos das etapas
  const [prazo, setPrazo] = useState(garantia.prazoGarantia ?? "")
  const [nfg, setNfg] = useState(garantia.nfgNumero ?? "")
  const [transportadora, setTransportadora] = useState(garantia.transportadoraNome ?? "")
  const [dataEnvio, setDataEnvio] = useState(garantia.dataEnvio ?? "")
  const [frete, setFrete] = useState(garantia.freteConta ?? "")
  const [notaEntrada, setNotaEntrada] = useState(garantia.notaEntrada ?? "")
  const [procedencia, setProcedencia] = useState(garantia.procedencia ?? "")
  const [tipoRetorno, setTipoRetorno] = useState(garantia.tipoRetorno ?? "")

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, patch: Partial<Garantia>, msg: string) {
    setLoading(true)
    const res = await fn()
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível concluir a ação.")
      return false
    }
    onPatch({ ...garantia, ...patch })
    toast.success(msg)
    return true
  }

  const status = garantia.status as GarantiaStatus

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações desta etapa</p>

      {/* TRIAGEM */}
      {status === "pendente" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Aprove para enviar à análise, ou rejeite informando o motivo.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={loading}
              onClick={() =>
                run(() => aprovarTriagemGarantia(garantia.id), { status: "em_analise" }, "Triagem aprovada — em análise.")
              }
            >
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Aprovar
            </Button>
            <Button variant="destructive" disabled={loading} onClick={() => setRejeitarOpen(true)}>
              <X className="mr-1.5 h-4 w-4" />
              Rejeitar
            </Button>
          </div>
        </div>
      )}

      {/* ANÁLISE — validar prazo */}
      {status === "em_analise" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prazo">Prazo da garantia (data limite)</Label>
            <Input id="prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="sm:w-56" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading}
              onClick={() =>
                run(
                  () => validarPrazoGarantia(garantia.id, prazo),
                  { status: "enviado", prazoGarantia: prazo, prazoValidado: true },
                  "Prazo validado — próxima etapa: envio.",
                )
              }
            >
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-1.5 h-4 w-4" />}
              Validar prazo e avançar
            </Button>
            <Button variant="destructive" disabled={loading} onClick={() => setRejeitarOpen(true)}>
              <X className="mr-1.5 h-4 w-4" />
              Rejeitar por prazo inválido
            </Button>
          </div>
        </div>
      )}

      {/* ENVIO — NFG + transportadora */}
      {status === "enviado" && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nfg">NFG — Nota fiscal de garantia *</Label>
              <Input id="nfg" value={nfg} onChange={(e) => setNfg(e.target.value)} placeholder="Nº da NFG" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transp">Transportadora</Label>
              <Input
                id="transp"
                value={transportadora}
                onChange={(e) => setTransportadora(e.target.value)}
                placeholder="Nome da transportadora"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dataenvio">Data de envio</Label>
              <Input id="dataenvio" type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Frete por conta de</Label>
              <Select value={frete} onValueChange={setFrete}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FRETE_CONTA.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FRETE_CONTA_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() =>
                run(
                  () =>
                    cadastrarEnvioGarantia(garantia.id, {
                      nfgNumero: nfg,
                      transportadoraNome: transportadora,
                      dataEnvio,
                      freteConta: frete,
                    }),
                  {
                    nfgNumero: nfg,
                    transportadoraNome: transportadora || null,
                    dataEnvio: dataEnvio || null,
                    freteConta: frete || null,
                    envioCadastrado: true,
                  },
                  "Envio cadastrado. Clique em Próxima etapa quando quiser avançar.",
                )
              }
            >
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Truck className="mr-1.5 h-4 w-4" />}
              Cadastrar envio
            </Button>

            <Button
              disabled={loading || !garantia.envioCadastrado}
              onClick={() =>
                run(
                  () => avancarEtapaGarantia(garantia.id),
                  { status: "esperando_retorno" },
                  "Avançado para Esperando retorno.",
                )
              }
            >
              <ArrowRight className="mr-1.5 h-4 w-4" />
              Próxima etapa
            </Button>
          </div>
          {garantia.envioCadastrado ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-500">
              <Check className="h-3.5 w-3.5" /> Envio cadastrado (NFG {garantia.nfgNumero}).
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Preencha a NFG e clique em &quot;Cadastrar envio&quot;. O ticket só avança quando você clicar em
              &quot;Próxima etapa&quot;.
            </p>
          )}
        </div>
      )}

      {/* ESPERANDO RETORNO — dados do retorno */}
      {status === "esperando_retorno" && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notaentrada">Nota de entrada</Label>
              <Input
                id="notaentrada"
                value={notaEntrada}
                onChange={(e) => setNotaEntrada(e.target.value)}
                placeholder="Nº da nota de entrada"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Procedência *</Label>
              <Select value={procedencia} onValueChange={setProcedencia}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PROCEDENCIA.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROCEDENCIA_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Como o valor/peça retorna *</Label>
              <Select value={tipoRetorno} onValueChange={setTipoRetorno}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_RETORNO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_RETORNO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={loading}
              onClick={() =>
                run(
                  () => registrarRetornoGarantia(garantia.id, { notaEntrada, procedencia, tipoRetorno }),
                  {
                    status: "concluido",
                    notaEntrada: notaEntrada || null,
                    procedencia: procedencia || null,
                    tipoRetorno: tipoRetorno || null,
                    concluidoEm: new Date(),
                  },
                  "Garantia concluída.",
                )
              }
            >
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              Concluir garantia
            </Button>
          </div>
        </div>
      )}

      {/* CONCLUÍDO — resumo */}
      {status === "concluido" && (
        <p className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          Garantia concluída{garantia.concluidoEm ? ` em ${fmtDate(garantia.concluidoEm)}` : ""}. Veja os dados abaixo.
        </p>
      )}

      <RejeitarDialog
        open={rejeitarOpen}
        onOpenChange={setRejeitarOpen}
        onConfirm={async (motivo) => {
          const res = await rejeitarGarantia(garantia.id, motivo)
          if (!res.ok) {
            toast.error(res.error ?? "Não foi possível rejeitar.")
            return false
          }
          toast.success("Garantia rejeitada. O vendedor foi avisado e pode reabrir em até 48h.")
          onRemove(garantia.id)
          return true
        }}
      />
    </section>
  )
}

function RejeitarDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: (motivo: string) => Promise<boolean>
}) {
  const [motivo, setMotivo] = useState("")
  const [loading, setLoading] = useState(false)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o: boolean) => (!o && !loading ? (setMotivo(""), onOpenChange(false)) : undefined)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rejeitar garantia</AlertDialogTitle>
          <AlertDialogDescription>
            O ticket será removido do quadro e o vendedor receberá um aviso com o motivo, podendo reabrir em até 48h.
            Informe o motivo da rejeição.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motivo-rej">Motivo da rejeição *</Label>
          <Textarea
            id="motivo-rej"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Fora do prazo de garantia; peça com sinais de mau uso..."
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || motivo.trim().length < 3}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async (e: React.MouseEvent) => {
              e.preventDefault()
              setLoading(true)
              const ok = await onConfirm(motivo.trim())
              setLoading(false)
              if (ok) {
                setMotivo("")
                onOpenChange(false)
              }
            }}
          >
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Confirmar rejeição
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Exibe todos os dados do ticket (cliente, produto, uso, defeito e etapas concluídas). */
function DadosGarantia({ garantia }: { garantia: Garantia }) {
  const frete = garantia.freteConta ? FRETE_CONTA_LABELS[garantia.freteConta as (typeof FRETE_CONTA)[number]] : null
  const proc = garantia.procedencia
    ? PROCEDENCIA_LABELS[garantia.procedencia as (typeof PROCEDENCIA)[number]]
    : null
  const retorno = garantia.tipoRetorno
    ? TIPO_RETORNO_LABELS[garantia.tipoRetorno as (typeof TIPO_RETORNO)[number]]
    : null

  return (
    <>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição do defeito</p>
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground text-pretty">
          {garantia.descricaoDefeito}
        </p>
      </section>

      {/* Dados do processo (preenchidos ao longo das etapas) */}
      {(garantia.prazoGarantia || garantia.nfgNumero || garantia.notaEntrada || proc) && (
        <section className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <p className="col-span-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Processo da garantia
          </p>
          <Field label="Prazo da garantia" value={garantia.prazoGarantia} />
          <Field label="NFG (nota fiscal de garantia)" value={garantia.nfgNumero} />
          <Field label="Transportadora" value={garantia.transportadoraNome} />
          <Field label="Data de envio" value={garantia.dataEnvio} />
          <Field label="Frete" value={frete} />
          <Field label="Nota de entrada" value={garantia.notaEntrada} />
          <Field label="Procedência" value={proc} />
          <Field label="Retorno" value={retorno} />
          <Field label="Concluída em" value={garantia.concluidoEm ? fmtDate(garantia.concluidoEm) : null} />
        </section>
      )}
    </>
  )
}
