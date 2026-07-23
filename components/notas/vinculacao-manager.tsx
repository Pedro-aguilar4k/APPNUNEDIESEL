"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Link2,
  PackagePlus,
  Search,
  AlertTriangle,
  Barcode,
  FileText,
  RotateCcw,
  Truck,
  Minus,
  Plus,
  Package,
  Tag,
  DollarSign,
  Save,
  Copy,
  Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buscarProdutosPorCodigos,
  salvarVinculacoes,
  type VinculacaoData,
  type VinculacaoItem,
  type ProdutoLookup,
  type Comprador,
} from "@/app/actions/vinculacao"

function fmtDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-BR")
}
function fmtCurrency(v: string | null) {
  if (v == null || v === "") return "—"
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtQty(v: string | null) {
  if (v == null) return "—"
  const n = Number(v)
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
}

type Etapa = "vincular" | "conferencia"

export function VinculacaoManager({
  data,
  compradores,
}: {
  data: VinculacaoData
  compradores: Comprador[]
}) {
  const router = useRouter()
  const { nota, itens } = data

  // No fluxo de Reconhecimento a nota só serve para absorver produtos: não há
  // conferência (bipagem) depois, então os textos e o destino mudam.
  const reconhecimento = nota.origem === "reconhecimento"
  const voltarHref = reconhecimento ? "/reconhecimento" : "/importar"

  // Itens já resolvidos automaticamente (EAN / equivalência aprendida) não
  // aparecem para vincular — o usuário só cuida dos pendentes.
  const jaVinculados = useMemo(() => itens.filter((i) => i.produtoId != null), [itens])
  const pendentes = useMemo(() => itens.filter((i) => i.produtoId == null), [itens])

  const [etapa, setEtapa] = useState<Etapa>(pendentes.length > 0 ? "vincular" : "conferencia")
  const [saving, setSaving] = useState(false)

  // Código interno digitado por item (itemId -> código).
  const [codigos, setCodigos] = useState<Record<number, string>>({})

  // Campos extras por item (definidos na vinculação).
  const [devolucoes, setDevolucoes] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(itens.map((i) => [i.id, i.devolucao])),
  )
  const [compradorSel, setCompradorSel] = useState<Record<number, string>>(() =>
    Object.fromEntries(itens.map((i) => [i.id, i.compradorId ?? ""])),
  )
  const [quantidades, setQuantidades] = useState<Record<number, string>>(() =>
    Object.fromEntries(itens.map((i) => [i.id, i.quantidade])),
  )
  const [justificativas, setJustificativas] = useState<Record<number, string>>(() =>
    Object.fromEntries(itens.map((i) => [i.id, i.justificativaQuantidade ?? ""])),
  )

  const setDevolucao = useCallback((itemId: number, v: boolean) => {
    setDevolucoes((prev) => ({ ...prev, [itemId]: v }))
  }, [])
  const setComprador = useCallback((itemId: number, v: string) => {
    setCompradorSel((prev) => ({ ...prev, [itemId]: v }))
  }, [])
  const setQuantidade = useCallback((itemId: number, v: string) => {
    setQuantidades((prev) => ({ ...prev, [itemId]: v }))
  }, [])
  const setJustificativa = useCallback((itemId: number, v: string) => {
    setJustificativas((prev) => ({ ...prev, [itemId]: v }))
  }, [])
  // Preview de produtos existentes por código interno.
  const [lookup, setLookup] = useState<Record<string, ProdutoLookup>>({})
  const [checking, setChecking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setCodigo = useCallback((itemId: number, valor: string) => {
    setCodigos((prev) => ({ ...prev, [itemId]: valor }))
  }, [])

  // Busca em lote os códigos digitados para mostrar o preview (existe / novo).
  const atualizarPreview = useCallback((mapa: Record<number, string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const lista = Object.values(mapa)
        .map((c) => c.trim())
        .filter(Boolean)
      if (!lista.length) {
        setLookup({})
        return
      }
      setChecking(true)
      try {
        const res = await buscarProdutosPorCodigos(lista)
        setLookup(res)
      } finally {
        setChecking(false)
      }
    }, 350)
  }, [])

  const handleCodigoChange = useCallback(
    (itemId: number, valor: string) => {
      const upper = valor.toUpperCase()
      setCodigo(itemId, upper)
      setCodigos((prev) => {
        const next = { ...prev, [itemId]: upper }
        atualizarPreview(next)
        return next
      })
    },
    [setCodigo, atualizarPreview],
  )

  const pendentesPreenchidos = pendentes.filter((i) => (codigos[i.id] ?? "").trim().length > 0).length
  const todosPreenchidos = pendentes.length === 0 || pendentesPreenchidos === pendentes.length

  // Verifica se alguma quantidade foi alterada sem justificativa (ou <= 0).
  function primeiroItemQtdInvalida(): VinculacaoItem | null {
    for (const item of itens) {
      const q = Number(quantidades[item.id] ?? item.quantidade)
      if (Number.isFinite(q) && q !== Number(item.quantidade)) {
        if (q <= 0 || !(justificativas[item.id] ?? "").trim()) return item
      }
    }
    return null
  }

  async function irParaConferencia() {
    if (!todosPreenchidos) {
      toast.error("Informe o código interno de todos os itens pendentes antes de conferir.")
      return
    }
    const invalido = primeiroItemQtdInvalida()
    if (invalido) {
      toast.error(`Justifique a alteração de quantidade de "${invalido.descricaoFornecedor ?? "item"}".`)
      return
    }
    setEtapa("conferencia")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSalvar() {
    const invalido = primeiroItemQtdInvalida()
    if (invalido) {
      toast.error(`Justifique a alteração de quantidade de "${invalido.descricaoFornecedor ?? "item"}".`)
      setEtapa("vincular")
      return
    }

    // Monta as entradas: itens pendentes com código digitado + itens já
    // vinculados (mantêm o código do produto atual, editável na conferência).
    const entradas: {
      itemId: number
      codigoInterno: string
      devolucao: boolean
      compradorId: string | null
      quantidade: string
      justificativaQuantidade: string | null
    }[] = []
    for (const item of itens) {
      const digitado = (codigos[item.id] ?? "").trim()
      const codigoFinal = digitado || item.produtoCodigoInterno || ""
      if (!codigoFinal) continue
      const justificativa = (justificativas[item.id] ?? "").trim()
      entradas.push({
        itemId: item.id,
        codigoInterno: codigoFinal,
        devolucao: devolucoes[item.id] ?? false,
        compradorId: compradorSel[item.id] ? compradorSel[item.id] : null,
        quantidade: quantidades[item.id] ?? item.quantidade,
        justificativaQuantidade: justificativa || null,
      })
    }

    if (entradas.length !== itens.length) {
      toast.error("Todos os itens precisam de um código interno para conferir a nota.")
      setEtapa("vincular")
      return
    }

    setSaving(true)
    try {
      const res = await salvarVinculacoes(nota.id, entradas)
      if (res.ok) {
        if (reconhecimento) {
          toast.success(
            `${res.vinculados} produto(s) reconhecido(s)` +
              (res.criados ? `, ${res.criados} novo(s) no cadastro.` : ".") +
              " Os itens já estão na lista de produtos.",
          )
        } else {
          toast.success(
            `Vinculação concluída: ${res.vinculados} item(ns) vinculado(s)` +
              (res.criados ? `, ${res.criados} produto(s) criado(s).` : ".") +
              " A nota está pronta para conferência do estoquista.",
          )
        }
        // Reconhecimento volta para /reconhecimento; importação de NF-e volta
        // para /importar (a conferência/bipagem é feita depois pelo estoquista).
        router.push(voltarHref)
      } else {
        toast.error(res.error)
      }
    } catch (e) {
      toast.error("Falha ao salvar vinculações.")
    } finally {
      setSaving(false)
    }
  }

  const titulo =
    etapa === "conferencia" ? "Revisão" : reconhecimento ? "Reconhecer produtos da NF-e" : "Vincular produtos da NF-e"
  const subtitulo =
    etapa === "conferencia"
      ? "Revise os itens da nota fiscal e informe os códigos internos ou crie novos produtos."
      : reconhecimento
        ? "Informe o código interno de cada produto. Ao salvar, os itens entram direto no cadastro de produtos."
        : "Informe o código interno de cada produto. Códigos novos criam o produto automaticamente."

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho + dados da nota */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 h-8 gap-1.5 text-muted-foreground">
            <Link href={voltarHref}>
              <ArrowLeft className="h-4 w-4" />
              {reconhecimento ? "Voltar para reconhecimento" : "Voltar para importação"}
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">{titulo}</h1>
              <p className="text-sm text-muted-foreground">
                Nota fiscal{" "}
                <span className="font-semibold text-foreground">
                  {nota.numero ?? "—"}
                  {nota.serie ? ` / ${nota.serie}` : ""}
                </span>
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">{subtitulo}</p>
        </div>
        <StepIndicator
          etapa={etapa}
          voltarHref={voltarHref}
          reconhecimento={reconhecimento}
          onVoltarVincular={pendentes.length > 0 ? () => setEtapa("vincular") : undefined}
        />
      </div>

      {etapa === "conferencia" && (
        <NotaResumo nota={nota} pendentes={pendentes.length} jaVinculados={jaVinculados.length} />
      )}

      {etapa === "vincular" ? (
        <EtapaVincular
          pendentes={pendentes}
          jaVinculados={jaVinculados}
          codigos={codigos}
          lookup={lookup}
          checking={checking}
          onCodigoChange={handleCodigoChange}
          preenchidos={pendentesPreenchidos}
          onAvancar={irParaConferencia}
          voltarHref={voltarHref}
          compradores={compradores}
          devolucoes={devolucoes}
          compradorSel={compradorSel}
          quantidades={quantidades}
          justificativas={justificativas}
          onDevolucaoChange={setDevolucao}
          onCompradorChange={setComprador}
          onQuantidadeChange={setQuantidade}
          onJustificativaChange={setJustificativa}
        />
      ) : (
        <EtapaConferencia
          itens={itens}
          codigos={codigos}
          lookup={lookup}
          saving={saving}
          onCodigoChange={handleCodigoChange}
          onVoltar={() => setEtapa("vincular")}
          onSalvar={handleSalvar}
          temPendentes={pendentes.length > 0}
          compradores={compradores}
          devolucoes={devolucoes}
          compradorSel={compradorSel}
          quantidades={quantidades}
        />
      )}
    </div>
  )
}

function StepIndicator({
  etapa,
  voltarHref,
  reconhecimento,
  onVoltarVincular,
}: {
  etapa: Etapa
  voltarHref: string
  reconhecimento: boolean
  onVoltarVincular?: () => void
}) {
  const vincularAtiva = etapa === "vincular"
  const revisaoAtiva = etapa === "conferencia"

  const base = "flex items-center gap-1.5 rounded-lg border px-3.5 py-2 font-semibold transition-colors"
  const ativo = "border-primary bg-primary text-primary-foreground"
  const inativoClicavel = "border-border bg-card text-foreground hover:bg-accent"
  const inativo = "border-border bg-card text-muted-foreground"

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
      {/* Etapa 1: Abertura (sempre concluída — volta para a lista de importação) */}
      <Link href={voltarHref} className={cn(base, inativoClicavel)}>
        <Upload className="h-4 w-4" /> 1. {reconhecimento ? "Reconhecimento" : "Abertura"}
      </Link>
      <div className="h-px w-3 bg-border" />

      {/* Etapa 2: Vincular */}
      <button
        type="button"
        onClick={revisaoAtiva ? onVoltarVincular : undefined}
        disabled={!revisaoAtiva || !onVoltarVincular}
        className={cn(base, vincularAtiva ? ativo : revisaoAtiva && onVoltarVincular ? inativoClicavel : inativo)}
      >
        <Link2 className="h-4 w-4" /> 2. Vincular
      </button>
      <div className="h-px w-3 bg-border" />

      {/* Etapa 3: Revisão */}
      <span className={cn(base, revisaoAtiva ? ativo : inativo)}>
        <CheckCircle2 className="h-4 w-4" /> 3. Revisão
      </span>
    </div>
  )
}

function NotaResumo({
  nota,
  pendentes,
  jaVinculados,
}: {
  nota: VinculacaoData["nota"]
  pendentes: number
  jaVinculados: number
}) {
  async function copiarChave() {
    if (!nota.chaveAcesso) return
    try {
      await navigator.clipboard.writeText(nota.chaveAcesso)
      toast.success("Chave de acesso copiada.")
    } catch {
      toast.error("Não foi possível copiar a chave.")
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          Dados da nota fiscal
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" />
          Nota lida com sucesso
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        <Campo rotulo="Número / Série" valor={`${nota.numero ?? "—"}${nota.serie ? " / " + nota.serie : ""}`} />
        <Campo rotulo="Fornecedor" valor={nota.fornecedorNome ?? "—"} span />
        <Campo rotulo="CNPJ" valor={nota.fornecedorCnpj ?? "—"} />
        <Campo rotulo="Emissão" valor={fmtDate(nota.dataEmissao)} />
        <Campo rotulo="Valor total" valor={fmtCurrency(nota.valorTotal)} />
        <Campo rotulo="Total de itens" valor={String(nota.totalItens ?? 0)} />
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          {jaVinculados > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> {jaVinculados} vinculado(s)
            </span>
          )}
          {pendentes > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">
              <AlertTriangle className="h-3.5 w-3.5" /> {pendentes} item(ns) a vincular
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> tudo vinculado
            </span>
          )}
        </div>
      </dl>
      {nota.chaveAcesso && (
        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Chave de acesso
            </span>
            <p className="mt-1 break-all font-mono text-sm text-foreground">{nota.chaveAcesso}</p>
          </div>
          <Button variant="outline" size="sm" onClick={copiarChave} className="shrink-0 gap-1.5 bg-transparent">
            <Copy className="h-4 w-4" />
            Copiar chave
          </Button>
        </div>
      )}
    </Card>
  )
}

function Campo({ rotulo, valor, span }: { rotulo: string; valor: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground" title={valor}>
        {valor}
      </dd>
    </div>
  )
}

function EtapaVincular({
  pendentes,
  jaVinculados,
  codigos,
  lookup,
  checking,
  onCodigoChange,
  preenchidos,
  onAvancar,
  voltarHref,
  compradores,
  devolucoes,
  compradorSel,
  quantidades,
  justificativas,
  onDevolucaoChange,
  onCompradorChange,
  onQuantidadeChange,
  onJustificativaChange,
}: {
  pendentes: VinculacaoItem[]
  jaVinculados: VinculacaoItem[]
  codigos: Record<number, string>
  lookup: Record<string, ProdutoLookup>
  checking: boolean
  onCodigoChange: (itemId: number, valor: string) => void
  preenchidos: number
  onAvancar: () => void
  voltarHref: string
  compradores: Comprador[]
  devolucoes: Record<number, boolean>
  compradorSel: Record<number, string>
  quantidades: Record<number, string>
  justificativas: Record<number, string>
  onDevolucaoChange: (itemId: number, v: boolean) => void
  onCompradorChange: (itemId: number, v: string) => void
  onQuantidadeChange: (itemId: number, v: string) => void
  onJustificativaChange: (itemId: number, v: string) => void
}) {
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const total = pendentes.length
  const safeIndex = Math.min(index, Math.max(0, total - 1))
  const todosOk = total === 0 || preenchidos === total

  // Autofoco no campo de código sempre que troca de item.
  useEffect(() => {
    inputRef.current?.focus()
  }, [safeIndex])

  const irAnterior = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const irProximo = useCallback(() => {
    setIndex((i) => (i < total - 1 ? i + 1 : i))
  }, [total])

  // Nenhum item pendente: tudo reconhecido automaticamente.
  if (total === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Card className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          Todos os itens já foram reconhecidos automaticamente. Revise e salve para concluir.
        </Card>
        {jaVinculados.length > 0 && <ReconhecidosCard jaVinculados={jaVinculados} />}
        <div className="flex justify-end">
          <Button onClick={onAvancar} className="gap-1.5">
        Revisar e salvar
        <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  const item = pendentes[safeIndex]
  const codigo = (codigos[item.id] ?? "").trim()
  const existente = codigo ? lookup[codigo] : undefined
  const itemPreenchido = codigo.length > 0
  const pct = Math.round((preenchidos / total) * 100)

  return (
    <div className="flex flex-col gap-6">
      {/* Progresso: Produto X de Y com navegação */}
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={irAnterior}
          disabled={safeIndex === 0}
          aria-label="Item anterior"
          className="h-11 w-11 shrink-0 bg-transparent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="w-full max-w-2xl">
          <p className="text-center text-lg font-semibold text-foreground">
            Produto <span className="text-primary">{safeIndex + 1}</span>{" "}
            <span className="text-muted-foreground">de {total}</span>
            {checking && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-muted-foreground" />}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">{pct}%</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={irProximo}
          disabled={safeIndex >= total - 1}
          aria-label="Próximo item"
          className="h-11 w-11 shrink-0 bg-transparent"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Card guiado: um produto por vez */}
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[1.4fr_1fr]">
          {/* Dados do item da nota */}
          <div className="border-b border-border p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Package className="h-6 w-6" />
                </span>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Produto da nota
                  </span>
                  <h3 className="mt-1 text-xl font-bold leading-snug text-foreground text-balance">
                    {item.descricaoFornecedor ?? "—"}
                  </h3>
                </div>
              </div>
              {item.ean && (
                <Badge variant="secondary" className="shrink-0 gap-1 font-mono">
                  <Barcode className="h-3 w-3" /> {item.ean}
                </Badge>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Campo rotulo="Cód. fornecedor" valor={item.codigoFornecedor ?? "—"} />
              <Campo rotulo="NCM" valor={item.ncm ?? "—"} />
              <Campo rotulo="Unidade" valor={item.unidade ?? "—"} />
            </dl>

            <div className="my-5 border-t border-border" />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Campo rotulo="Quantidade na nota" valor={`${fmtQty(item.quantidade)} ${item.unidade ?? ""}`.trim()} />
              <Campo rotulo="Valor unitário" valor={fmtCurrency(item.valorUnitario)} />
              <Campo rotulo="Valor total" valor={fmtCurrency(item.valorTotal)} />
            </dl>

            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-sm text-muted-foreground">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-pretty">Dados extraídos da NF-e. Confira as informações ao lado e prossiga.</span>
            </div>
          </div>

          {/* Código interno + preview + extras */}
          <div className="flex flex-col gap-5 bg-muted/30 p-6 sm:p-7">
            <div>
              <label htmlFor="codigo-interno-atual" className="text-sm font-semibold text-foreground">
                Código interno
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                Vincule o produto da nota a um produto do seu estoque.
              </p>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="codigo-interno-atual"
                  ref={inputRef}
                  value={codigos[item.id] ?? ""}
                  onChange={(e) => onCodigoChange(item.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault()
                      if (safeIndex < total - 1) irProximo()
                      else onAvancar()
                    }
                  }}
                  placeholder="Ex.: P1234"
                  autoComplete="off"
                  className="h-12 pr-10 font-mono text-base"
                  aria-label={`Código interno para ${item.descricaoFornecedor ?? "item"}`}
                />
              </div>
            </div>

            <PreviewVinculo codigo={codigo} checking={checking} existente={existente} />

            <ItemExtras
              item={item}
              compradores={compradores}
              devolucao={devolucoes[item.id] ?? false}
              comprador={compradorSel[item.id] ?? ""}
              quantidade={quantidades[item.id] ?? item.quantidade}
              justificativa={justificativas[item.id] ?? ""}
              onDevolucaoChange={(v) => onDevolucaoChange(item.id, v)}
              onCompradorChange={(v) => onCompradorChange(item.id, v)}
              onQuantidadeChange={(v) => onQuantidadeChange(item.id, v)}
              onJustificativaChange={(v) => onJustificativaChange(item.id, v)}
            />

            {/* Resumo do item */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Resumo do item</p>
              <div className="grid grid-cols-3 gap-3">
                <ResumoChip
                  icon={Package}
                  valor={`${fmtQty(quantidades[item.id] ?? item.quantidade)} ${item.unidade ?? ""}`.trim()}
                  rotulo="Quantidade"
                />
                <ResumoChip icon={Tag} valor={fmtCurrency(item.valorUnitario)} rotulo="Valor unitário" />
                <ResumoChip icon={DollarSign} valor={fmtCurrency(item.valorTotal)} rotulo="Valor total" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Barra inferior: navegação + rascunho + próximo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={irAnterior}
          disabled={safeIndex === 0}
          className="gap-1.5 bg-transparent"
        >
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </Button>

        {/* Indicador de itens */}
        {total <= 15 ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {pendentes.map((it, i) => {
              const ok = (codigos[it.id] ?? "").trim().length > 0
              const atual = i === safeIndex
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para o item ${i + 1}`}
                  aria-current={atual ? "true" : undefined}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    atual ? "w-6 bg-primary" : ok ? "w-2.5 bg-success" : "w-2.5 bg-border hover:bg-muted-foreground/40",
                  )}
                />
              )
            })}
          </div>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">
            {preenchidos}/{total} preenchido(s)
          </span>
        )}

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-1.5 bg-transparent">
            <Link href={voltarHref}>
              <Save className="h-4 w-4" />
              Salvar rascunho
            </Link>
          </Button>
          {safeIndex < total - 1 ? (
            <Button onClick={irProximo} disabled={!itemPreenchido} className="gap-1.5">
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={onAvancar} disabled={!todosOk} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Revisar e salvar
            </Button>
          )}
        </div>
      </div>

      {jaVinculados.length > 0 && <ReconhecidosCard jaVinculados={jaVinculados} />}
    </div>
  )
}

function ResumoChip({
  icon: Icon,
  valor,
  rotulo,
}: {
  icon: typeof Package
  valor: string
  rotulo: string
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg bg-muted/50 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-bold leading-tight text-foreground">{valor}</span>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
    </div>
  )
}

function ItemExtras({
  item,
  compradores,
  devolucao,
  comprador,
  quantidade,
  justificativa,
  onDevolucaoChange,
  onCompradorChange,
  onQuantidadeChange,
  onJustificativaChange,
}: {
  item: VinculacaoItem
  compradores: Comprador[]
  devolucao: boolean
  comprador: string
  quantidade: string
  justificativa: string
  onDevolucaoChange: (v: boolean) => void
  onCompradorChange: (v: string) => void
  onQuantidadeChange: (v: string) => void
  onJustificativaChange: (v: string) => void
}) {
  const qtdNum = Number(quantidade)
  const qtdOriginal = Number(item.quantidade)
  const qtdMudou = Number.isFinite(qtdNum) && qtdNum !== qtdOriginal
  const semJustificativa = qtdMudou && !justificativa.trim()

  const ajustar = (delta: number) => {
    const base = Number.isFinite(qtdNum) ? qtdNum : qtdOriginal
    const novo = Math.max(0, base + delta)
    onQuantidadeChange(String(novo))
  }

  const NONE = "__nenhum__"

  return (
    <div className="flex flex-col gap-4">
      {/* Quantidade */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-foreground">Quantidade</label>
          <span className="text-xs text-muted-foreground">
            Nota: {fmtQty(item.quantidade)} {item.unidade ?? ""}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 bg-transparent"
            onClick={() => ajustar(-1)}
            aria-label="Diminuir quantidade"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            value={quantidade}
            onChange={(e) => onQuantidadeChange(e.target.value.replace(",", "."))}
            inputMode="decimal"
            className={cn("h-9 text-center tabular-nums", qtdMudou && "border-amber-500 font-semibold")}
            aria-label="Quantidade do item"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 bg-transparent"
            onClick={() => ajustar(1)}
            aria-label="Aumentar quantidade"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {qtdMudou && (
          <div className="mt-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Quantidade alterada de {fmtQty(item.quantidade)} para {fmtQty(quantidade)} — justifique.
            </div>
            <Textarea
              value={justificativa}
              onChange={(e) => onJustificativaChange(e.target.value)}
              placeholder="Ex.: 2 unidades vieram avariadas / faltou 1 no volume."
              rows={2}
              className={cn("text-sm", semJustificativa && "border-amber-500")}
              aria-label="Justificativa da alteração de quantidade"
              aria-invalid={semJustificativa}
            />
          </div>
        )}
      </div>

      {/* Devolução */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
          devolucao ? "border-destructive/40 bg-destructive/10" : "border-border bg-background/60",
        )}
      >
        <div className="flex items-center gap-2">
          <RotateCcw className={cn("h-4 w-4", devolucao ? "text-destructive" : "text-muted-foreground")} />
          <div>
            <p className="text-sm font-medium text-foreground">Devolução</p>
            <p className="text-xs text-muted-foreground">Marque se esta peça é uma devolução.</p>
          </div>
        </div>
        <Switch checked={devolucao} onCheckedChange={onDevolucaoChange} aria-label="Marcar como devolução" />
      </div>

      {/* Entregar para (comprador) */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Truck className="h-4 w-4 text-muted-foreground" />
          Entregar para
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">Opcional — comprador responsável pela peça.</p>
        <Select
          value={comprador || NONE}
          onValueChange={(v) => onCompradorChange(v === NONE ? "" : v)}
        >
          <SelectTrigger className="mt-2 h-9">
            <SelectValue placeholder="Ninguém" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Ninguém</SelectItem>
            {compradores.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {compradores.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">Nenhum usuário com papel &quot;comprador&quot; cadastrado.</p>
        )}
      </div>
    </div>
  )
}

function PreviewVinculo({
  codigo,
  checking,
  existente,
}: {
  codigo: string
  checking: boolean
  existente: ProdutoLookup | undefined
}) {
  if (!codigo) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground">
        <Search className="h-4 w-4 shrink-0" />
        Digite o código interno para continuar.
      </div>
    )
  }
  if (checking && !existente) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        Verificando código…
      </div>
    )
  }
  if (existente) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          <Link2 className="h-4 w-4" />
          Vincular a produto existente
        </div>
        <p className="mt-1.5 text-sm font-medium text-foreground">{existente.descricao}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-mono">Cód. {existente.codigoInterno}</span>
          {existente.codigoBarras && <span className="font-mono">EAN {existente.codigoBarras}</span>}
          {existente.unidade && <span>Un. {existente.unidade}</span>}
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-accent-brand/30 bg-accent-brand/10 p-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-accent-brand">
        <PackagePlus className="h-4 w-4" />
        Novo produto será criado
      </div>
      <p className="mt-1.5 text-sm text-foreground text-pretty">
        Será cadastrado com a descrição, EAN, NCM, unidade e custo desta nota.
      </p>
    </div>
  )
}

function ReconhecidosCard({ jaVinculados }: { jaVinculados: VinculacaoItem[] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border p-4">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <h2 className="text-base font-semibold text-foreground">
          Reconhecidos automaticamente ({jaVinculados.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-64">Produto na nota</TableHead>
              <TableHead>Código interno</TableHead>
              <TableHead>Produto vinculado</TableHead>
              <TableHead>Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jaVinculados.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.descricaoFornecedor ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{item.produtoCodigoInterno ?? "—"}</TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {item.produtoDescricao ?? "—"}
                </TableCell>
                <TableCell>
                  <MatchBadge tipo={item.matchTipo} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

function EtapaConferencia({
  itens,
  codigos,
  lookup,
  saving,
  onCodigoChange,
  onVoltar,
  onSalvar,
  temPendentes,
  compradores,
  devolucoes,
  compradorSel,
  quantidades,
}: {
  itens: VinculacaoItem[]
  codigos: Record<number, string>
  lookup: Record<string, ProdutoLookup>
  saving: boolean
  onCodigoChange: (itemId: number, valor: string) => void
  onVoltar: () => void
  onSalvar: () => void
  temPendentes: boolean
  compradores: Comprador[]
  devolucoes: Record<number, boolean>
  compradorSel: Record<number, string>
  quantidades: Record<number, string>
}) {
  const compradorNome = (id: string) => compradores.find((c) => c.id === id)?.name ?? null

  function codigoDoItem(item: VinculacaoItem) {
    const digitado = (codigos[item.id] ?? "").trim()
    return digitado || item.produtoCodigoInterno || ""
  }

  const vinculadosCount = itens.filter((item) => {
    const c = codigoDoItem(item)
    if (!c) return false
    const ex = lookup[c]
    const je = item.produtoCodigoInterno && item.produtoCodigoInterno === c
    return !!(je || ex)
  }).length

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">Revisão dos itens</h2>
              <p className="text-sm text-muted-foreground">
                Revise todos os itens e ajuste os códigos internos se necessário.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground">
              <Package className="h-4 w-4 text-muted-foreground" />
              {itens.length} {itens.length === 1 ? "item na nota" : "itens na nota"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              {vinculadosCount} vinculado(s)
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-64">Produto na nota</TableHead>
                <TableHead>Cód. forn.</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Vlr unit.</TableHead>
                <TableHead className="min-w-40">Marcações</TableHead>
                <TableHead className="min-w-48">Código interno</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => {
                const codigo = codigoDoItem(item)
                const existente = codigo ? lookup[codigo] : undefined
                const jaEra = item.produtoCodigoInterno && item.produtoCodigoInterno === codigo
                const vinculaExistente = !!(jaEra || existente)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-foreground">
                      {item.descricaoFornecedor ?? "—"}
                      {item.ncm && (
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">NCM {item.ncm}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.codigoFornecedor ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{item.ean ?? "—"}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {(() => {
                        const q = quantidades[item.id] ?? item.quantidade
                        const mudou = Number(q) !== Number(item.quantidade)
                        return (
                          <div className="flex flex-col items-center">
                            <span className={cn(mudou && "font-semibold text-warning")}>
                              {fmtQty(q)} {item.unidade ?? ""}
                            </span>
                            {mudou && (
                              <span className="text-[11px] text-muted-foreground line-through">
                                {fmtQty(item.quantidade)}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCurrency(item.valorUnitario)}</TableCell>
                    <TableCell>
                      {(() => {
                        const dev = devolucoes[item.id] ?? false
                        const compId = compradorSel[item.id] ?? ""
                        const nome = compId ? compradorNome(compId) : null
                        if (!dev && !nome) return <span className="text-xs text-muted-foreground">—</span>
                        return (
                          <div className="flex flex-col gap-1">
                            {dev && (
                              <Badge className="w-fit gap-1 bg-destructive/15 text-destructive hover:bg-destructive/15">
                                <RotateCcw className="h-3 w-3" /> Devolução
                              </Badge>
                            )}
                            {nome && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Truck className="h-3 w-3" /> {nome}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          value={codigos[item.id] ?? item.produtoCodigoInterno ?? ""}
                          onChange={(e) => onCodigoChange(item.id, e.target.value)}
                          className={cn("h-10 pr-9 font-mono", codigo && "border-success/50")}
                          aria-label={`Código interno de ${item.descricaoFornecedor ?? "item"}`}
                        />
                        {codigo && (
                          <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {!codigo ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 px-2.5 py-1 text-xs font-semibold text-warning">
                          <AlertTriangle className="h-3.5 w-3.5" /> Sem código
                        </span>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" /> OK
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-medium",
                              vinculaExistente ? "text-muted-foreground" : "text-primary",
                            )}
                          >
                            {vinculaExistente ? (
                              <>
                                <Link2 className="h-3 w-3" /> vincula existente
                              </>
                            ) : (
                              <>
                                <PackagePlus className="h-3 w-3" /> cria novo
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-start gap-2.5 border-t border-border bg-muted/30 px-5 py-3.5 text-sm text-muted-foreground">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="text-pretty">
            Itens com código interno preenchido serão vinculados ao produto existente. Itens sem código poderão ser
            criados automaticamente.
          </span>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {temPendentes ? (
          <Button variant="outline" onClick={onVoltar} className="gap-1.5 bg-transparent" disabled={saving}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para vinculação
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={onSalvar} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Salvar e voltar para importação
        </Button>
      </div>
    </div>
  )
}

function MatchBadge({ tipo }: { tipo: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    ean: { label: "EAN", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    equivalencia: { label: "Equivalência", className: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
    manual: { label: "Manual", className: "bg-muted text-muted-foreground" },
    similaridade: { label: "Similaridade", className: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  }
  const cfg = map[tipo ?? ""] ?? { label: tipo ?? "—", className: "bg-muted text-muted-foreground" }
  return <Badge className={`${cfg.className} hover:${cfg.className}`}>{cfg.label}</Badge>
}
