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
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

export function VinculacaoManager({ data }: { data: VinculacaoData }) {
  const router = useRouter()
  const { nota, itens } = data

  // Itens já resolvidos automaticamente (EAN / equivalência aprendida) não
  // aparecem para vincular — o usuário só cuida dos pendentes.
  const jaVinculados = useMemo(() => itens.filter((i) => i.produtoId != null), [itens])
  const pendentes = useMemo(() => itens.filter((i) => i.produtoId == null), [itens])

  const [etapa, setEtapa] = useState<Etapa>(pendentes.length > 0 ? "vincular" : "conferencia")
  const [saving, setSaving] = useState(false)

  // Código interno digitado por item (itemId -> código).
  const [codigos, setCodigos] = useState<Record<number, string>>({})
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

  async function irParaConferencia() {
    if (!todosPreenchidos) {
      toast.error("Informe o código interno de todos os itens pendentes antes de conferir.")
      return
    }
    setEtapa("conferencia")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSalvar() {
    // Monta as entradas: itens pendentes com código digitado + itens já
    // vinculados (mantêm o código do produto atual, editável na conferência).
    const entradas: { itemId: number; codigoInterno: string }[] = []
    for (const item of itens) {
      const digitado = (codigos[item.id] ?? "").trim()
      const codigoFinal = digitado || item.produtoCodigoInterno || ""
      if (codigoFinal) entradas.push({ itemId: item.id, codigoInterno: codigoFinal })
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
        toast.success(
          `Vinculação salva: ${res.vinculados} item(ns) vinculado(s)` +
            (res.criados ? `, ${res.criados} produto(s) criado(s).` : "."),
        )
        router.push(`/conferencia/${nota.id}`)
      } else {
        toast.error(res.error)
      }
    } catch (e) {
      toast.error("Falha ao salvar vinculações.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho + dados da nota */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 h-8 gap-1.5 text-muted-foreground">
            <Link href="/importar">
              <ArrowLeft className="h-4 w-4" />
              Voltar para importação
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
            Vincular produtos da NF-e
          </h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Informe o código interno de cada produto. Códigos novos criam o produto automaticamente.
          </p>
        </div>
        <StepIndicator etapa={etapa} />
      </div>

      <NotaResumo nota={nota} pendentes={pendentes.length} jaVinculados={jaVinculados.length} />

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
        />
      )}
    </div>
  )
}

function StepIndicator({ etapa }: { etapa: Etapa }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
          etapa === "vincular"
            ? "bg-accent-brand text-accent-brand-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Link2 className="h-3.5 w-3.5" /> 1. Vincular
      </span>
      <div className="h-px w-4 bg-border" />
      <span
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
          etapa === "conferencia"
            ? "bg-accent-brand text-accent-brand-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> 2. Conferência
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
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="h-4 w-4 text-accent-brand" />
        Dados da nota fiscal
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        <Campo rotulo="Número / Série" valor={`${nota.numero ?? "—"}${nota.serie ? " / " + nota.serie : ""}`} />
        <Campo rotulo="Fornecedor" valor={nota.fornecedorNome ?? "—"} span />
        <Campo rotulo="CNPJ" valor={nota.fornecedorCnpj ?? "—"} />
        <Campo rotulo="Emissão" valor={fmtDate(nota.dataEmissao)} />
        <Campo rotulo="Valor total" valor={fmtCurrency(nota.valorTotal)} />
        <Campo rotulo="Total de itens" valor={String(nota.totalItens ?? 0)} />
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          {jaVinculados > 0 && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {jaVinculados} reconhecido(s)
            </Badge>
          )}
          {pendentes > 0 ? (
            <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {pendentes} a vincular
            </Badge>
          ) : (
            <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> tudo vinculado
            </Badge>
          )}
        </div>
      </dl>
      {nota.chaveAcesso && (
        <div className="mt-4 border-t border-border pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chave de acesso</span>
          <p className="mt-0.5 break-all font-mono text-xs text-foreground">{nota.chaveAcesso}</p>
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
}: {
  pendentes: VinculacaoItem[]
  jaVinculados: VinculacaoItem[]
  codigos: Record<number, string>
  lookup: Record<string, ProdutoLookup>
  checking: boolean
  onCodigoChange: (itemId: number, valor: string) => void
  preenchidos: number
  onAvancar: () => void
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
          Todos os itens já foram reconhecidos automaticamente. Revise na conferência geral.
        </Card>
        {jaVinculados.length > 0 && <ReconhecidosCard jaVinculados={jaVinculados} />}
        <div className="flex justify-end">
          <Button onClick={onAvancar} className="gap-1.5">
            Conferência geral
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

  return (
    <div className="flex flex-col gap-6">
      {/* Progresso */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              Item {safeIndex + 1} de {total}
            </span>
            <span className="text-muted-foreground">
              {preenchidos}/{total} preenchido(s)
              {checking && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent-brand transition-all duration-300"
              style={{ width: `${(preenchidos / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Navegação por itens (bolinhas numeradas) */}
      <div className="flex flex-wrap gap-1.5">
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
                "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                atual
                  ? "border-accent-brand bg-accent-brand text-accent-brand-foreground"
                  : ok
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {ok && !atual ? <Check className="h-4 w-4" /> : i + 1}
            </button>
          )
        })}
      </div>

      {/* Card guiado: um produto por vez */}
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[1.5fr_1fr]">
          {/* Dados do item da nota */}
          <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Produto na nota
                </span>
                <h3 className="mt-1 text-lg font-semibold leading-snug text-foreground text-balance">
                  {item.descricaoFornecedor ?? "—"}
                </h3>
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
              <Campo rotulo="Quantidade" valor={`${fmtQty(item.quantidade)} ${item.unidade ?? ""}`.trim()} />
              <Campo rotulo="Valor unitário" valor={fmtCurrency(item.valorUnitario)} />
              <Campo rotulo="Valor total" valor={fmtCurrency(item.valorTotal)} />
            </dl>
          </div>

          {/* Código interno + preview */}
          <div className="flex flex-col gap-4 bg-muted/30 p-6">
            <div>
              <label htmlFor="codigo-interno-atual" className="text-sm font-semibold text-foreground">
                Código interno
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                Se o código não existir, o produto é criado automaticamente com os dados da nota.
              </p>
              <Input
                id="codigo-interno-atual"
                ref={inputRef}
                value={codigos[item.id] ?? ""}
                onChange={(e) => onCodigoChange(item.id, e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    e.keyCode !== 229
                  ) {
                    e.preventDefault()
                    if (safeIndex < total - 1) irProximo()
                    else onAvancar()
                  }
                }}
                placeholder="Ex.: P1234"
                autoComplete="off"
                className="mt-3 h-11 font-mono text-base"
                aria-label={`Código interno para ${item.descricaoFornecedor ?? "item"}`}
              />
            </div>

            <PreviewVinculo codigo={codigo} checking={checking} existente={existente} />
          </div>
        </div>
      </Card>

      {/* Navegação inferior */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={irAnterior} disabled={safeIndex === 0} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </Button>
        <div className="flex items-center gap-2">
          {safeIndex < total - 1 && (
            <Button
              variant={todosOk ? "outline" : "default"}
              onClick={irProximo}
              disabled={!itemPreenchido}
              className="gap-1.5"
            >
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={onAvancar} disabled={!todosOk} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Conferência geral
          </Button>
        </div>
      </div>

      {jaVinculados.length > 0 && <ReconhecidosCard jaVinculados={jaVinculados} />}
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
}: {
  itens: VinculacaoItem[]
  codigos: Record<number, string>
  lookup: Record<string, ProdutoLookup>
  saving: boolean
  onCodigoChange: (itemId: number, valor: string) => void
  onVoltar: () => void
  onSalvar: () => void
  temPendentes: boolean
}) {
  function codigoDoItem(item: VinculacaoItem) {
    const digitado = (codigos[item.id] ?? "").trim()
    return digitado || item.produtoCodigoInterno || ""
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center gap-2 border-b border-border p-4">
          <CheckCircle2 className="h-4 w-4 text-accent-brand" />
          <h2 className="text-base font-semibold text-foreground">Conferência geral</h2>
          <span className="text-sm text-muted-foreground">
            Revise todos os itens e ajuste os códigos internos se necessário.
          </span>
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
                <TableHead className="text-right">Vlr total</TableHead>
                <TableHead className="min-w-48">Código interno</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => {
                const codigo = codigoDoItem(item)
                const existente = codigo ? lookup[codigo] : undefined
                const jaEra = item.produtoCodigoInterno && item.produtoCodigoInterno === codigo
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
                      {fmtQty(item.quantidade)} {item.unidade ?? ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCurrency(item.valorUnitario)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCurrency(item.valorTotal)}</TableCell>
                    <TableCell>
                      <Input
                        value={codigos[item.id] ?? item.produtoCodigoInterno ?? ""}
                        onChange={(e) => onCodigoChange(item.id, e.target.value)}
                        className="h-9 font-mono"
                        aria-label={`Código interno de ${item.descricaoFornecedor ?? "item"}`}
                      />
                    </TableCell>
                    <TableCell>
                      {!codigo ? (
                        <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> sem código
                        </Badge>
                      ) : jaEra || existente ? (
                        <Badge variant="secondary" className="gap-1">
                          <Link2 className="h-3 w-3" /> existente
                        </Badge>
                      ) : (
                        <Badge className="gap-1 bg-accent-brand/15 text-accent-brand hover:bg-accent-brand/15">
                          <PackagePlus className="h-3 w-3" /> novo
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {temPendentes ? (
          <Button variant="outline" onClick={onVoltar} className="gap-1.5" disabled={saving}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para vinculação
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={onSalvar} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Salvar e ir para conferência
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
