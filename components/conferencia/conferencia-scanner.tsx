"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  Loader2,
  PackageCheck,
  RotateCcw,
  Truck,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ItemStatusBadge } from "@/components/status-badge"
import { ProdutoCombobox } from "@/components/conferencia/produto-combobox"
import { ConferenciaRelatorio } from "@/components/conferencia/conferencia-relatorio"
import {
  processarLeitura,
  adicionarCodigoItem,
  vincularItem,
  iniciarConferencia,
  finalizarConferencia,
  type LeituraResult,
} from "@/app/actions/conferencia"

type GameItem = {
  id: number
  cprod: string | null
  ean: string | null
  descricaoNfe: string | null
  produtoId: number | null
  produtoCodigo: string | null
  produtoDescricao: string | null
  quantidade: number
  quantidadeConferida: number
  unidade: string | null
  statusConferencia: string
  devolucao: boolean
  compradorNome: string | null
  quantidadeOriginal: number | null
  justificativaQuantidade: string | null
}

type Nota = {
  id: number
  numero: string | null
  fornecedorNome: string | null
  status: string
  importadoPor?: string | null
}

type ConferenciaData = {
  nota: Nota
  itens: GameItem[]
  progress: { itensCompletos: number; totalItens: number }
}

// Beep curto via Web Audio. Reutiliza um único AudioContext para evitar
// a latência (e o limite de contextos) de recriar um a cada leitura.
let sharedAudioCtx: AudioContext | null = null
function beep(kind: "ok" | "error") {
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const ctx = sharedAudioCtx
    if (ctx.state === "suspended") void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = kind === "ok" ? 1040 : 220
    osc.type = kind === "ok" ? "sine" : "square"
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0.14, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.start(t)
    osc.stop(t + 0.1)
  } catch {
    /* ignora ambientes sem áudio */
  }
}

const FEEDBACK: Record<
  LeituraResult["tipo"],
  { color: string; icon: typeof CheckCircle2; sound: "ok" | "error" }
> = {
  completo: { color: "border-success bg-success/10 text-success", icon: PackageCheck, sound: "ok" },
  parcial: { color: "border-primary bg-primary/10 text-primary", icon: CheckCircle2, sound: "ok" },
  duplicado_ignorado: { color: "border-muted bg-muted text-muted-foreground", icon: CheckCircle2, sound: "ok" },
  nao_pertence: { color: "border-destructive bg-destructive/10 text-destructive", icon: XCircle, sound: "error" },
  desconhecido: { color: "border-destructive bg-destructive/10 text-destructive", icon: XCircle, sound: "error" },
  produto_errado: { color: "border-warning bg-warning/10 text-warning", icon: AlertTriangle, sound: "error" },
  ja_conferido: { color: "border-warning bg-warning/10 text-warning", icon: AlertTriangle, sound: "error" },
}

export function ConferenciaScanner({ initial, canBind }: { initial: ConferenciaData; canBind: boolean }) {
  const [itens, setItens] = useState<GameItem[]>(initial.itens)
  const [progress, setProgress] = useState(initial.progress)
  const [status, setStatus] = useState(initial.nota.status)
  const [codigo, setCodigo] = useState("")
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<LeituraResult | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  // Se a nota já foi finalizada, abre direto no relatório.
  const [finalizado, setFinalizado] = useState(
    initial.nota.status === "conferida" || initial.nota.status === "divergente",
  )
  const inputRef = useRef<HTMLInputElement>(null)

  // Refs para acessar o estado mais recente dentro do loop da fila.
  const activeIdRef = useRef<number | null>(null)
  const statusRef = useRef(status)
  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const focusInput = useCallback(() => inputRef.current?.focus(), [])

  useEffect(() => {
    focusInput()
  }, [focusInput])

  const pct = progress.totalItens > 0 ? Math.round((progress.itensCompletos / progress.totalItens) * 100) : 0
  const semVinculo = useMemo(() => itens.filter((i) => !i.produtoId), [itens])
  const activeItem = useMemo(() => itens.find((i) => i.id === activeId) ?? null, [itens, activeId])

  function applyResult(res: LeituraResult) {
    setLast(res)
    setProgress(res.progress)
    const fb = FEEDBACK[res.tipo]
    beep(fb.sound)
    if (res.item) {
      setItens((prev) =>
        prev.map((i) =>
          i.id === res.item!.id
            ? { ...i, quantidadeConferida: res.item!.quantidadeConferida, statusConferencia: res.item!.statusConferencia }
            : i,
        ),
      )
      // Mantém como item ativo enquanto não estiver completo.
      if (res.tipo === "parcial") {
        setActiveId(res.item.id)
        activeIdRef.current = res.item.id
      } else if (res.tipo === "completo") {
        setActiveId(null)
        activeIdRef.current = null
      }
    }
    if (res.notaCompleta && res.success) {
      toast.success("Todos os itens foram conferidos!")
    }
  }

  // Drena a fila de leituras uma a uma, sem bloquear novas bipagens.
  const drainQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    setBusy(true)
    try {
      while (queueRef.current.length > 0) {
        const value = queueRef.current.shift()!
        if (statusRef.current !== "em_conferencia") {
          const start = await iniciarConferencia(initial.nota.id)
          if (!start.ok) {
            toast.error(start.error)
            queueRef.current = [] // descarta pendentes até resolver o bloqueio
            break
          }
          statusRef.current = "em_conferencia"
          setStatus("em_conferencia")
        }
        try {
          const res = await processarLeitura({
            notaId: initial.nota.id,
            codigoBarras: value,
            itemAtivoId: activeIdRef.current,
            scanUuid: crypto.randomUUID(),
          })
          applyResult(res)
        } catch {
          toast.error("Erro ao processar leitura.")
        }
      }
    } finally {
      processingRef.current = false
      setBusy(false)
      focusInput()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.nota.id, focusInput])

  function handleScan(e?: React.FormEvent) {
    e?.preventDefault()
    const value = codigo.trim()
    if (!value) return
    // Enfileira e libera o input imediatamente para a próxima leitura.
    queueRef.current.push(value)
    setCodigo("")
    focusInput()
    void drainQueue()
  }

  async function handleBind(itemId: number, produtoId: number, descricao: string) {
    const res = await vincularItem({ itemNotaId: itemId, produtoId })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setItens((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, produtoId, produtoDescricao: descricao, produtoCodigo: null } : i)),
    )
    toast.success("Item vinculado. O sistema aprendeu esse produto para o fornecedor.")
  }

  // Bipar código para um item sem EAN (adiciona o código ao produto e conta +1).
  async function handleAddCodeToItem(itemId: number, value: string) {
    const res = await adicionarCodigoItem({
      notaId: initial.nota.id,
      itemNotaId: itemId,
      codigoBarras: value,
      scanUuid: crypto.randomUUID(),
    })
    applyResult(res)
  }

  async function handleFinalizar() {
    const res = await finalizarConferencia(initial.nota.id)
    if (res.ok) {
      toast.success(res.status === "conferida" ? "Nota conferida com sucesso!" : "Nota finalizada com divergências.")
      setStatus(res.status)
      setFinalizado(true)
    }
  }

  // Conferência finalizada: mostra a etapa de relatório.
  if (finalizado) {
    return (
      <ConferenciaRelatorio
        nota={{ id: initial.nota.id, numero: initial.nota.numero, fornecedorNome: initial.nota.fornecedorNome }}
        itens={itens.map((i) => ({
          id: i.id,
          produtoCodigo: i.produtoCodigo,
          produtoDescricao: i.produtoDescricao,
          descricaoNfe: i.descricaoNfe,
          quantidade: i.quantidade,
          quantidadeConferida: i.quantidadeConferida,
          unidade: i.unidade,
          statusConferencia: i.statusConferencia,
        }))}
        status={status === "divergente" ? "divergente" : "conferida"}
      />
    )
  }

  const fb = last ? FEEDBACK[last.tipo] : null
  const FbIcon = fb?.icon

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground">
          <Link href="/conferencia">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {initial.nota.numero ? `Conferência · Nota Nº ${initial.nota.numero}` : `Conferência · Nota #${initial.nota.id}`}
            </h1>
            <p className="text-sm text-muted-foreground">{initial.nota.fornecedorNome ?? "Sem fornecedor"}</p>
            {initial.nota.importadoPor && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Importada por <span className="font-medium text-foreground">{initial.nota.importadoPor}</span>
              </p>
            )}
          </div>
          <Button onClick={handleFinalizar} variant="outline">
            Finalizar conferência
          </Button>
        </div>
      </div>

      {/* Visor de bipagem */}
      <Card className="flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Progresso: {progress.itensCompletos}/{progress.totalItens} itens
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2.5" />

        {/* Item ativo / feedback grande */}
        <div
          className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 p-6 text-center transition-colors ${
            fb ? fb.color : "border-dashed border-border text-muted-foreground"
          }`}
          aria-live="polite"
        >
          {last && FbIcon ? (
            <>
              <FbIcon className="h-10 w-10" />
              <p className="text-lg font-bold text-balance">{last.message}</p>
              {last.item?.devolucao && (
                <span className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-sm font-bold uppercase tracking-wide text-destructive-foreground">
                  <RotateCcw className="h-4 w-4" />
                  Devolução
                </span>
              )}
              {last.item?.produtoDescricao && (
                <p className="text-sm opacity-80 text-balance">{last.item.produtoDescricao}</p>
              )}
              {last.item?.compradorNome && (
                <p className="inline-flex items-center gap-1 text-sm font-medium">
                  <Truck className="h-4 w-4" />
                  Entregar para {last.item.compradorNome}
                </p>
              )}
              {last.scanned?.descricao && last.tipo === "produto_errado" && (
                <p className="text-xs opacity-70">Bipado: {last.scanned.descricao}</p>
              )}
              {last.item && (
                <p className="text-sm font-semibold tabular-nums">
                  {last.item.quantidadeConferida} / {last.item.quantidade} {last.item.unidade ?? ""}
                </p>
              )}
            </>
          ) : (
            <>
              <ScanLine className="h-10 w-10" />
              <p className="text-lg font-medium text-balance">Bipe o código de barras do produto</p>
            </>
          )}
        </div>

        <form onSubmit={handleScan} className="flex gap-2">
          <Input
            ref={inputRef}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onBlur={(e) => {
              // Só recupera o foco se ele não foi para outro campo/botão
              // (combobox de vínculo, bipar inline, finalizar, etc.).
              const next = e.relatedTarget as HTMLElement | null
              if (
                next &&
                (next.tagName === "INPUT" ||
                  next.tagName === "BUTTON" ||
                  next.closest('[role="dialog"]') ||
                  next.closest('[role="listbox"]'))
              ) {
                return
              }
              setTimeout(focusInput, 0)
            }}
            placeholder="Código de barras..."
            className="h-12 text-lg"
            autoComplete="off"
            inputMode="numeric"
            autoFocus
            aria-label="Código de barras"
          />
          <Button type="submit" size="lg" disabled={!codigo.trim()} className="h-12 px-6">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Bipar"}
          </Button>
        </form>
      </Card>

      {/* Itens sem vínculo (bloqueiam a conferência completa) */}
      {semVinculo.length > 0 && (
        <Card className="flex flex-col gap-3 border-warning/40 bg-warning/5 p-5">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <h2 className="text-sm font-semibold">
              {semVinculo.length} item(ns) sem produto vinculado
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Vincule cada item a um produto do catálogo para poder conferi-lo. O sistema memoriza o vínculo por fornecedor.
          </p>
          <div className="flex flex-col divide-y divide-border">
            {semVinculo.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{i.descricaoNfe}</p>
                  <p className="text-xs text-muted-foreground">Cód. fornecedor: {i.cprod ?? "—"}</p>
                </div>
                {canBind ? (
                  <ProdutoCombobox onSelect={(pid, desc) => handleBind(i.id, pid, desc)} />
                ) : (
                  <span className="text-xs text-muted-foreground">Sem permissão para vincular</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lista de itens */}
      <Card className="flex flex-col divide-y divide-border">
        {itens.map((i) => {
          const done = i.quantidadeConferida >= i.quantidade && i.quantidade > 0
          const isActive = i.id === activeId
          return (
            <div
              key={i.id}
              className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
                i.devolucao ? "border-l-4 border-destructive bg-destructive/5" : ""
              } ${isActive ? "bg-primary/5" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {i.devolucao && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-destructive-foreground">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Devolução
                    </span>
                  )}
                  <p className="truncate font-medium text-foreground">
                    {i.produtoDescricao ?? i.descricaoNfe}
                  </p>
                  <ItemStatusBadge status={done ? "conferido" : i.produtoId ? i.statusConferencia : "nao_encontrado"} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {i.produtoDescricao ? `NF-e: ${i.descricaoNfe}` : `Cód. fornecedor: ${i.cprod ?? "—"}`}
                  {i.ean ? ` · EAN ${i.ean}` : ""}
                </p>
                {(i.compradorNome || i.quantidadeOriginal != null) && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {i.compradorNome && (
                      <span className="inline-flex items-center gap-1 font-medium text-primary">
                        <Truck className="h-3.5 w-3.5" />
                        Entregar para {i.compradorNome}
                      </span>
                    )}
                    {i.quantidadeOriginal != null && (
                      <span
                        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                        title={i.justificativaQuantidade ?? undefined}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Qtd ajustada (era {i.quantidadeOriginal})
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-sm font-semibold tabular-nums ${done ? "text-success" : "text-foreground"}`}
                >
                  {i.quantidadeConferida} / {i.quantidade} {i.unidade ?? ""}
                </span>
                {i.produtoId && !i.ean && !done && (
                  <BipCodigoInline onSubmit={(v) => handleAddCodeToItem(i.id, v)} />
                )}
                {!done && i.produtoId && (
                  <Button
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => {
                      setActiveId(i.id)
                      activeIdRef.current = i.id
                      focusInput()
                    }}
                  >
                    {isActive ? "No visor" : "Focar"}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

// Input inline para bipar um código quando o item não tem EAN cadastrado.
function BipCodigoInline({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => setOpen(true)}>
        <Link2 className="h-3.5 w-3.5" />
        Bipar código
      </Button>
    )
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) {
          onSubmit(value.trim())
          setValue("")
          setOpen(false)
        }
      }}
      className="flex items-center gap-1"
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Código..."
        className="h-8 w-32"
        onBlur={() => !value && setOpen(false)}
      />
      <Button size="sm" type="submit" className="h-8">
        OK
      </Button>
    </form>
  )
}
