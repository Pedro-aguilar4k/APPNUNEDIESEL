"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  PackageCheck,
  RotateCcw,
  Truck,
  User,
  LogOut,
  FastForward,
  Barcode,
  FileText,
  ListChecks,
  Package,
  Box,
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
  ncm: string | null
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

// Título curto e amigável exibido no aviso dinâmico, por tipo de leitura.
const TITULOS: Record<LeituraResult["tipo"], string> = {
  completo: "Item conferido!",
  parcial: "Unidade registrada",
  duplicado_ignorado: "Leitura duplicada ignorada",
  nao_pertence: "Produto não pertence a esta nota",
  desconhecido: "Código não reconhecido",
  produto_errado: "Produto não é o indicado no visor",
  ja_conferido: "Este item já foi conferido",
}

export function ConferenciaScanner({ initial, canBind }: { initial: ConferenciaData; canBind: boolean }) {
  const [itens, setItens] = useState<GameItem[]>(initial.itens)
  const [progress, setProgress] = useState(initial.progress)
  const [status, setStatus] = useState(initial.nota.status)
  const [codigo, setCodigo] = useState("")
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<LeituraResult | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  // Itens "pulados" — apenas navegação visual no cliente, não persiste nada.
  const [skippedIds, setSkippedIds] = useState<Set<number>>(() => new Set())
  const [showAllItems, setShowAllItems] = useState(false)
  // Se a nota já foi finalizada, abre direto no relatório.
  const [finalizado, setFinalizado] = useState(
    initial.nota.status === "conferida" || initial.nota.status === "divergente",
  )
  // Modo conferência: visor em tela cheia para bipar sem distração.
  const [modoConferencia, setModoConferencia] = useState(false)
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

  // O aviso dinâmico some sozinho e a tela volta ao estado neutro. Sucessos
  // desaparecem mais rápido; erros/avisos ficam um pouco mais para leitura.
  useEffect(() => {
    if (!last) return
    const ms = last.success ? 2600 : 4200
    const t = setTimeout(() => setLast(null), ms)
    return () => clearTimeout(t)
  }, [last])

  // Entra/sai do modo conferência usando a Fullscreen API do navegador quando
  // disponível. Se o usuário sair com Esc, o estado acompanha.
  const toggleModoConferencia = useCallback(() => {
    setModoConferencia((prev) => {
      const next = !prev
      try {
        if (next) void document.documentElement.requestFullscreen?.()
        else if (document.fullscreenElement) void document.exitFullscreen()
      } catch {
        /* alguns navegadores bloqueiam fullscreen — o overlay já cobre a tela */
      }
      return next
    })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setModoConferencia(false)
    }
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  useEffect(() => {
    if (modoConferencia) focusInput()
  }, [modoConferencia, focusInput])

  const pct = progress.totalItens > 0 ? Math.round((progress.itensCompletos / progress.totalItens) * 100) : 0
  const semVinculo = useMemo(() => itens.filter((i) => !i.produtoId), [itens])
  const activeItem = useMemo(() => itens.find((i) => i.id === activeId) ?? null, [itens, activeId])

  // Item exibido nos painéis: o item em contagem no visor, senão o próximo
  // pendente ainda não pulado, senão qualquer pendente, senão o último.
  const currentItem = useMemo(() => {
    if (activeItem && activeItem.quantidadeConferida < activeItem.quantidade) return activeItem
    const pendentes = itens.filter(
      (i) => i.produtoId && i.quantidade > 0 && i.quantidadeConferida < i.quantidade,
    )
    const naoPulado = pendentes.find((i) => !skippedIds.has(i.id))
    return naoPulado ?? pendentes[0] ?? itens[itens.length - 1] ?? null
  }, [activeItem, itens, skippedIds])

  const currentIndex = useMemo(
    () => (currentItem ? itens.findIndex((i) => i.id === currentItem.id) : -1),
    [currentItem, itens],
  )

  // Indicadores dos cards superiores.
  const totalItens = progress.totalItens || itens.length
  const conferidos = progress.itensCompletos
  const pendentes = Math.max(0, totalItens - conferidos)
  const pulados = useMemo(
    () => itens.filter((i) => skippedIds.has(i.id) && i.quantidadeConferida < i.quantidade).length,
    [itens, skippedIds],
  )
  const pctDe = (n: number) => (totalItens > 0 ? Math.round((n / totalItens) * 100) : 0)

  function applyResult(res: LeituraResult) {
    setLast(res)
    setProgress(res.progress)
    const fb = FEEDBACK[res.tipo]
    beep(fb.sound)
    if (res.item) {
      const itemId = res.item.id
      setItens((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, quantidadeConferida: res.item!.quantidadeConferida, statusConferencia: res.item!.statusConferencia }
            : i,
        ),
      )
      // Bipou um item que estava pulado — remove da lista de pulados.
      setSkippedIds((prev) => {
        if (!prev.has(itemId)) return prev
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
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
    } else if (!res.success) {
      toast.error(res.message)
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

  // Pular item: apenas navegação visual (avança para o próximo pendente).
  function handlePularItem() {
    if (!currentItem) return
    setSkippedIds((prev) => {
      const next = new Set(prev)
      next.add(currentItem.id)
      return next
    })
    setActiveId(null)
    activeIdRef.current = null
    focusInput()
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

  // Visor de bipagem — usado apenas no modo tela cheia.
  const visor = (
    <div
      className={`flex min-h-64 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 p-4 text-center transition-colors sm:p-6 ${
        fb ? fb.color : "border-dashed border-border text-muted-foreground"
      }`}
      aria-live="polite"
    >
      {last && FbIcon ? (
        <div className="flex w-full flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <FbIcon className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
            <p className="text-xl font-extrabold leading-tight text-balance sm:text-2xl">{last.message}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 empty:hidden">
            {last.item?.devolucao && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-base font-bold uppercase tracking-wide text-destructive-foreground">
                <RotateCcw className="h-5 w-5" />
                Devolução
              </span>
            )}
            {last.item?.compradorNome && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-base font-semibold text-primary-foreground">
                <Truck className="h-5 w-5" />
                Entregar para {last.item.compradorNome}
              </span>
            )}
          </div>

          {last.item && (
            <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-sm">
              <p className="border-b border-border px-5 py-3.5 text-center text-lg font-bold leading-snug text-balance sm:text-xl">
                {last.item.produtoDescricao ?? last.item.descricaoNfe ?? "Sem descrição"}
              </p>

              <div className="px-5 pb-2 pt-4 text-center">
                <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Código interno
                </span>
                <span className="block break-all font-mono text-5xl font-extrabold leading-tight tracking-tight text-foreground sm:text-6xl">
                  {last.item.produtoCodigo?.trim() ? last.item.produtoCodigo : "—"}
                </span>
              </div>

              <div className="mx-5 mb-4 mt-2 rounded-xl bg-muted px-4 py-3 text-center">
                <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Conferido
                </span>
                <span className="block text-4xl font-extrabold tabular-nums leading-none text-foreground">
                  {last.item.quantidadeConferida}
                  <span className="text-2xl text-muted-foreground">/{last.item.quantidade}</span>
                  {last.item.unidade && (
                    <span className="ml-2 text-base font-semibold uppercase text-muted-foreground">
                      {last.item.unidade}
                    </span>
                  )}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2">
                <FichaCampo label="Código original" valor={last.item.cprod} />
                <FichaCampo label="EAN" valor={last.item.ean} />
              </dl>
            </div>
          )}

          {last.scanned?.descricao && last.tipo === "produto_errado" && (
            <p className="text-sm opacity-70 text-balance">Você bipou: {last.scanned.descricao}</p>
          )}
        </div>
      ) : (
        <>
          <ScanLine className="h-16 w-16" />
          <p className="text-xl font-semibold text-balance sm:text-2xl">Bipe o código de barras do produto</p>
          <p className="text-sm text-muted-foreground text-balance">
            Aponte o leitor para o código da peça — o resultado aparece aqui em destaque.
          </p>
        </>
      )}
    </div>
  )

  // Formulário de bipagem simples (modo tela cheia).
  const scanForm = (
    <form onSubmit={handleScan} className="flex gap-2">
      <Input
        ref={inputRef}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
        }}
        onBlur={(e) => {
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
  )

  // Modo conferência: tela cheia dedicada à bipagem.
  if (modoConferencia) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-background p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground">
              {initial.nota.numero ? `Nota Nº ${initial.nota.numero}` : `Nota #${initial.nota.id}`}
            </p>
            <p className="truncate text-xs text-muted-foreground">{initial.nota.fornecedorNome ?? "Sem fornecedor"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {progress.itensCompletos}/{progress.totalItens} itens · {pct}%
            </span>
            <Button variant="outline" onClick={toggleModoConferencia} className="gap-1.5 bg-transparent">
              <Minimize2 className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
        <Progress value={pct} className="h-3" />
        {visor}
        {scanForm}
      </div>
    )
  }

  const codigoInterno = currentItem?.produtoCodigo?.trim() ? currentItem.produtoCodigo : "—"

  return (
    <div className="flex flex-col gap-5 pb-32">
      {/* Cabeçalho: marca + título + indicadores + encerrar */}
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Conferência de NF-e</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
              {initial.nota.numero ? `NF-e Nº ${initial.nota.numero}` : `NF-e #${initial.nota.id}`}
            </h1>
            {initial.nota.fornecedorNome ? (
              <p className="mt-1 text-sm text-muted-foreground">{initial.nota.fornecedorNome}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-stretch gap-3">
            <IndicadorCard
              icon={CheckCircle2}
              tone="success"
              valor={conferidos}
              titulo="Conferidos"
              rodape={`${pctDe(conferidos)}% do total`}
            />
            <IndicadorCard
              icon={Box}
              tone="primary"
              valor={pendentes}
              titulo="Pendentes"
              rodape={`${pctDe(pendentes)}% do total`}
            />
            <IndicadorCard
              icon={FastForward}
              tone="warning"
              valor={pulados}
              titulo="Pulados"
              rodape={`${pctDe(pulados)}% do total`}
            />
            <IndicadorCard
              icon={Barcode}
              tone="muted"
              valor={totalItens}
              titulo="Total de itens"
            />
            <Button
              onClick={handleFinalizar}
              variant="outline"
              className="h-auto gap-2 self-stretch bg-transparent px-5"
            >
              <LogOut className="h-4 w-4" />
              Encerrar conferência
            </Button>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="relative">
          <Progress value={pct} className="h-4 [&>*]:bg-success [&>*]:transition-all [&>*]:duration-500" />
          <span className="mt-2 flex justify-center">
            <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
              {pct}% concluído
            </span>
          </span>
        </div>
      </header>

      {/* Itens sem vínculo (bloqueiam a conferência completa) */}
      {semVinculo.length > 0 && (
        <Card className="flex flex-col gap-3 border-warning/40 bg-warning/5 p-5">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <h2 className="text-sm font-semibold">{semVinculo.length} item(ns) sem produto vinculado</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Vincule cada item a um produto do catálogo para poder conferi-lo. O sistema memoriza o vínculo por
            fornecedor.
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

      {/* Aviso dinâmico da última leitura (some sozinho) */}
      {last && fb && FbIcon && (
        <div
          role="status"
          aria-live="assertive"
          className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-4 shadow-sm duration-300 animate-in fade-in slide-in-from-top-2 ${fb.color}`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/60">
            <FbIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold leading-tight text-balance sm:text-xl">{TITULOS[last.tipo]}</p>
            <p className="text-sm font-medium leading-snug opacity-80 text-pretty">{last.message}</p>
          </div>
          {last.item && last.item.quantidade > 0 && (
            <span className="hidden shrink-0 items-center gap-1 rounded-xl border-2 border-current px-4 py-2 font-mono text-2xl font-extrabold sm:inline-flex">
              {last.item.quantidadeConferida}
              <span className="text-base font-bold opacity-60">/{last.item.quantidade}</span>
            </span>
          )}
        </div>
      )}

      {/* Área principal: produto (esquerda) + quantidade (direita) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Produto */}
        <Card className="flex flex-col gap-6 p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-success">
              <Package className="h-4 w-4" />
              {currentItem ? `Item ${currentIndex + 1} de ${itens.length}` : `${itens.length} itens`}
            </span>
            {currentItem && skippedIds.has(currentItem.id) && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-warning">
                <FastForward className="h-3.5 w-3.5" />
                Pulado
              </span>
            )}
          </div>

          {currentItem ? (
            <>
              <div className="flex flex-wrap items-center gap-2 empty:hidden">
                {currentItem.devolucao && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-destructive-foreground">
                    <RotateCcw className="h-4 w-4" />
                    Devolução
                  </span>
                )}
                {currentItem.compradorNome && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                    <Truck className="h-4 w-4" />
                    Entregar para {currentItem.compradorNome}
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Código interno
                </p>
                <p className="break-all font-mono text-6xl font-extrabold leading-none tracking-tight text-success sm:text-7xl">
                  {codigoInterno}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Descrição</p>
                <p className="mt-1 text-2xl font-bold leading-snug text-foreground text-balance sm:text-3xl">
                  {currentItem.produtoDescricao ?? currentItem.descricaoNfe ?? "Sem descrição"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Código original (nota)
                </p>
                <div className="mt-1.5 inline-flex rounded-lg border border-border bg-muted/50 px-4 py-2.5">
                  <span className="font-mono text-xl font-bold text-foreground">
                    {currentItem.cprod?.trim() ? currentItem.cprod : "—"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
                <FichaCampo label="NCM" valor={currentItem.ncm} icon={FileText} />
                <FichaCampo label="EAN (GTIN)" valor={currentItem.ean} icon={Barcode} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
              <PackageCheck className="h-12 w-12 text-success" />
              <p className="text-lg font-semibold text-foreground">Todos os itens conferidos</p>
              <p className="text-sm">Encerre a conferência para gerar o relatório.</p>
            </div>
          )}
        </Card>

        {/* Quantidade */}
        <Card className="flex flex-col gap-5 p-6 sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quantidade da nota</p>
            <p className="mt-1 flex items-end gap-2 leading-none">
              <span className="font-mono text-6xl font-extrabold tabular-nums tracking-tight text-primary sm:text-7xl">
                {currentItem ? currentItem.quantidade : "—"}
              </span>
              {currentItem && (
                <span className="mb-1 text-2xl font-semibold uppercase text-muted-foreground">
                  {currentItem.unidade ?? "UN"}
                </span>
              )}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Conferido</p>
            <div className="mt-1.5 flex items-center justify-center rounded-xl border-2 border-success bg-success/5 px-4 py-5 transition-all duration-200">
              <span className="flex items-end gap-2 leading-none">
                <span className="font-mono text-5xl font-extrabold tabular-nums text-success">
                  {currentItem ? currentItem.quantidadeConferida : 0}
                </span>
                <span className="mb-0.5 text-xl font-semibold uppercase text-success/70">
                  {currentItem?.unidade ?? "UN"}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handlePularItem}
              variant="outline"
              disabled={!currentItem}
              className="h-14 gap-2 border-warning/60 bg-transparent text-base font-bold text-warning hover:bg-warning/10 hover:text-warning"
            >
              <FastForward className="h-5 w-5" />
              Pular este item
            </Button>
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              Não encontrei todas as unidades agora.
              <br />
              Posso conferir depois.
            </p>
          </div>

          {/* Bipar código inline para itens sem EAN cadastrado */}
          {currentItem?.produtoId &&
            !currentItem.ean &&
            currentItem.quantidadeConferida < currentItem.quantidade && (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Este item não tem EAN. Bipe um código para cadastrá-lo:
                </p>
                <BipCodigoInline onSubmit={(v) => handleAddCodeToItem(currentItem.id, v)} />
              </div>
            )}
        </Card>
      </div>

      {/* Ver todos os itens */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowAllItems((v) => !v)}
          className="gap-2 bg-transparent text-primary"
        >
          <ListChecks className="h-4 w-4" />
          {showAllItems ? "Ocultar itens" : "Ver todos os itens"}
        </Button>
      </div>

      {showAllItems && (
        <Card className="flex flex-col divide-y divide-border">
          {itens.map((i) => {
            const done = i.quantidadeConferida >= i.quantidade && i.quantidade > 0
            const isActive = i.id === currentItem?.id
            const isSkipped = skippedIds.has(i.id) && !done
            return (
              <div
                key={i.id}
                className={`flex flex-col gap-2 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
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
                    <p className="truncate font-medium text-foreground">{i.produtoDescricao ?? i.descricaoNfe}</p>
                    {isSkipped ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                        <FastForward className="h-3 w-3" />
                        Pulado
                      </span>
                    ) : (
                      <ItemStatusBadge
                        status={done ? "conferido" : i.produtoId ? i.statusConferencia : "nao_encontrado"}
                      />
                    )}
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
                  <span className={`text-sm font-semibold tabular-nums ${done ? "text-success" : "text-foreground"}`}>
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
                        setSkippedIds((prev) => {
                          if (!prev.has(i.id)) return prev
                          const next = new Set(prev)
                          next.delete(i.id)
                          return next
                        })
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
      )}

      {/* Barra de bipagem fixa */}
      <div className="sticky bottom-3 z-30 mt-1">
        <form
          onSubmit={handleScan}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg lg:flex-row lg:items-stretch"
        >
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-200 lg:w-72 ${
              !last
                ? "bg-primary text-primary-foreground"
                : last.tipo === "completo"
                  ? "bg-success text-success-foreground"
                  : last.tipo === "produto_errado" || last.tipo === "ja_conferido"
                    ? "bg-warning text-warning-foreground"
                    : last.success
                      ? "bg-primary text-primary-foreground"
                      : "bg-destructive text-destructive-foreground"
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-background/20">
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : fb && FbIcon ? (
                <FbIcon className="h-6 w-6" />
              ) : (
                <ScanLine className="h-6 w-6" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">{last ? TITULOS[last.tipo] : "Aguardando leitura"}</p>
              <p className="truncate text-xs opacity-70">
                {last ? "Pronto para a próxima leitura" : "Posicione o código de barras no leitor ou digite manualmente"}
              </p>
            </div>
          </div>

          <div className="relative flex flex-1 items-center">
            <Barcode className="pointer-events-none absolute right-4 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
              }}
              onBlur={(e) => {
                // Só recupera o foco se ele não foi para outro campo/botão.
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
              placeholder="Digite ou escaneie o código de barras..."
              className="h-14 pr-11 text-lg"
              autoComplete="off"
              inputMode="numeric"
              autoFocus
              aria-label="Código de barras"
            />
          </div>

          <Button
            type="submit"
            disabled={!codigo.trim() || busy}
            className="h-14 gap-2 bg-success px-8 text-lg font-bold text-success-foreground hover:bg-success/90"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Barcode className="h-6 w-6" />}
            BIPAR
          </Button>
        </form>
        <p className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
          <span>Dica: você pode digitar o EAN, GTIN ou código de barras do produto.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleModoConferencia}
            className="h-auto gap-1.5 px-2 py-1 text-muted-foreground"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Modo tela cheia
          </Button>
        </p>
      </div>
    </div>
  )
}

// Card indicador do topo (Conferidos, Pendentes, Pulados, Total).
function IndicadorCard({
  icon: Icon,
  tone,
  valor,
  titulo,
  rodape,
}: {
  icon: typeof CheckCircle2
  tone: "success" | "primary" | "warning" | "muted"
  valor: number
  titulo: string
  rodape?: string
}) {
  const tones: Record<string, string> = {
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    muted: "bg-muted text-muted-foreground",
  }
  return (
    <Card className="flex min-w-[9rem] items-center gap-3 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none tabular-nums text-foreground">{valor}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{titulo}</p>
        {rodape && <p className="text-xs text-muted-foreground">{rodape}</p>}
      </div>
    </Card>
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

/** Campo da ficha da peça (rótulo + valor) em formato de pílula legível. */
function FichaCampo({
  label,
  valor,
  icon: Icon,
}: {
  label: string
  valor?: string | null
  icon?: typeof CheckCircle2
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-base font-bold text-foreground">{valor?.trim() ? valor : "—"}</dd>
    </div>
  )
}
