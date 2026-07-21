"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { Plus, Search, PackageSearch, Minus, MapPin, Loader2, TriangleAlert, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adicionarEspera, removerUnidadesEspera } from "@/app/actions/espera"
import {
  ESPERA_TIPOS,
  ESPERA_TIPO_LABELS,
  resumoEmbalagem,
  type EsperaItem,
  type EsperaTipo,
} from "@/lib/espera"
import { cn } from "@/lib/utils"

export function EsperaManager({ itens }: { itens: EsperaItem[] }) {
  const [busca, setBusca] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [addAlvo, setAddAlvo] = useState<EsperaItem | null>(null)
  const [removerAlvo, setRemoverAlvo] = useState<EsperaItem | null>(null)
  const [pending, startTransition] = useTransition()

  const termo = busca.trim().toLowerCase()

  // Resultado(s) da busca: casa por código ou descrição.
  const encontrados = useMemo(() => {
    if (!termo) return []
    return itens.filter(
      (i) => i.codigoInterno.toLowerCase().includes(termo) || (i.descricao ?? "").toLowerCase().includes(termo),
    )
  }, [termo, itens])

  const totalGeral = itens.reduce((s, i) => s + i.totalUnidades, 0)

  // Gera e baixa uma planilha .xlsx com todos os itens da espera.
  function exportarExcel() {
    if (itens.length === 0) {
      toast.error("Não há itens na espera para exportar.")
      return
    }
    const linhas = itens.map((item) => {
      const r = resumoEmbalagem(item)
      return {
        "Código": item.codigoInterno,
        "Descrição": item.descricao ?? "",
        "Total (un)": item.totalUnidades,
        "Guardado como": ESPERA_TIPO_LABELS[item.tipo as EsperaTipo],
        "Un. por embalagem": item.unidadesPorEmbalagem,
        "Embalagens": item.tipo === "unidade" ? "" : r.embalagens,
        "Última parcial (un)": r.ultimaParcial ? r.soltasNaUltima : "",
        "Box primário": item.boxPrimario,
        "Box secundário": item.boxSecundario ?? "",
      }
    })
    const ws = XLSX.utils.json_to_sheet(linhas)
    ws["!cols"] = [
      { wch: 14 },
      { wch: 34 },
      { wch: 11 },
      { wch: 14 },
      { wch: 16 },
      { wch: 11 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Espera")
    const data = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `espera-${data}.xlsx`)
    toast.success("Planilha da espera gerada.")
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Bloco central: ações + busca + resultado */}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {/* Ações acima da busca */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={exportarExcel}>
            <FileDown className="mr-1.5 h-4 w-4" />
            Exportar para Excel
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar item
          </Button>
        </div>

        {/* Barra de busca com botão Buscar */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o código do item..."
              className="h-14 pl-12 text-lg font-mono"
              aria-label="Pesquisar item na espera"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" className="h-14 px-6">
            <Search className="mr-1.5 h-5 w-5" />
            Buscar
          </Button>
        </form>

        {/* Resultado da busca */}
        {termo && encontrados.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-destructive">
            <TriangleAlert className="h-5 w-5 shrink-0" />
            <p className="font-medium">Produto não localizado</p>
          </div>
        )}

        {termo &&
          encontrados.map((item) => (
            <ResultadoCard
              key={item.id}
              item={item}
              onAdicionar={() => setAddAlvo(item)}
              onRemover={() => setRemoverAlvo(item)}
            />
          ))}
      </div>

      {/* Lista simples de todos os itens cadastrados */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-medium text-muted-foreground">
            Itens na espera
          </p>
          <span className="text-sm text-muted-foreground">
            {itens.length} {itens.length === 1 ? "item" : "itens"} · {totalGeral} un
          </span>
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
            <PackageSearch className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Espera vazia</p>
              <p className="text-sm text-muted-foreground">Adicione itens que não couberam na locação normal.</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {itens.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setBusca(item.codigoInterno)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="font-mono text-sm font-semibold text-foreground">{item.codigoInterno}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {item.descricao ?? "Sem descrição"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {item.boxPrimario}
                    {item.boxSecundario ? ` · ${item.boxSecundario}` : ""}
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                    {item.totalUnidades} un
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdicionarDialog open={addOpen} onOpenChange={setAddOpen} pending={pending} startTransition={startTransition} />
      <AdicionarExistenteDialog
        item={addAlvo}
        onOpenChange={(o) => !o && setAddAlvo(null)}
        pending={pending}
        startTransition={startTransition}
      />
      <RemoverDialog
        item={removerAlvo}
        onOpenChange={(o) => !o && setRemoverAlvo(null)}
        pending={pending}
        startTransition={startTransition}
      />
    </div>
  )
}

function ResultadoCard({
  item,
  onAdicionar,
  onRemover,
}: {
  item: EsperaItem
  onAdicionar: () => void
  onRemover: () => void
}) {
  const r = resumoEmbalagem(item)
  const tipo = item.tipo as EsperaTipo
  const isEmbalagem = item.tipo !== "unidade" && item.unidadesPorEmbalagem > 1

  return (
    <div className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm">
      {/* Código bem grande + descrição */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-4xl font-bold leading-none tracking-tight text-foreground sm:text-5xl">
            {item.codigoInterno}
          </p>
          <p className="mt-2 truncate text-sm text-muted-foreground">
            {item.descricao ?? "Sem descrição no cadastro"}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {ESPERA_TIPO_LABELS[tipo]}
        </Badge>
      </div>

      {/* Quantidade */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-foreground">{item.totalUnidades}</span>
          <span className="text-base text-muted-foreground">unidades</span>
        </div>
        {isEmbalagem && (
          <p className="mt-1 text-sm text-muted-foreground">
            {r.embalagens}{" "}
            {r.embalagens === 1
              ? ESPERA_TIPO_LABELS[tipo].toLowerCase()
              : `${ESPERA_TIPO_LABELS[tipo].toLowerCase()}s`}{" "}
            de {item.unidadesPorEmbalagem} un
            {r.ultimaParcial && (
              <span className="text-amber-600 dark:text-amber-500"> · última parcial ({r.soltasNaUltima} un)</span>
            )}
          </p>
        )}
      </div>

      {/* Localização */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Localização:
        </span>
        <span className="rounded-md bg-muted px-2 py-1 text-sm font-semibold text-foreground">{item.boxPrimario}</span>
        {item.boxSecundario && (
          <span className="rounded-md bg-muted/60 px-2 py-1 text-sm text-muted-foreground">{item.boxSecundario}</span>
        )}
      </div>

      {/* Ações: verde adiciona, vermelho remove */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          size="lg"
          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={onAdicionar}
        >
          <Plus className="mr-1.5 h-5 w-5" />
          Adicionar
        </Button>
        <Button size="lg" variant="destructive" className="flex-1" onClick={onRemover}>
          <Minus className="mr-1.5 h-5 w-5" />
          Remover
        </Button>
      </div>
    </div>
  )
}

function AdicionarDialog({
  open,
  onOpenChange,
  pending,
  startTransition,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pending: boolean
  startTransition: (cb: () => void) => void
}) {
  const [codigo, setCodigo] = useState("")
  const [boxPrimario, setBoxPrimario] = useState("")
  const [boxSecundario, setBoxSecundario] = useState("")
  const [tipo, setTipo] = useState<EsperaTipo>("unidade")
  const [upe, setUpe] = useState("")
  const [quantidade, setQuantidade] = useState("")

  const isEmbalagem = tipo !== "unidade"
  const previewUnidades = isEmbalagem ? (Number(quantidade) || 0) * (Number(upe) || 0) : Number(quantidade) || 0

  function reset() {
    setCodigo("")
    setBoxPrimario("")
    setBoxSecundario("")
    setTipo("unidade")
    setUpe("")
    setQuantidade("")
  }

  function submit() {
    startTransition(async () => {
      const res = await adicionarEspera({
        codigoInterno: codigo,
        boxPrimario,
        boxSecundario: boxSecundario || undefined,
        tipo,
        unidadesPorEmbalagem: isEmbalagem ? Number(upe) : 1,
        quantidade: Number(quantidade),
      })
      if (res.ok) {
        toast.success(`Item ${res.codigo} adicionado à espera`)
        reset()
        onOpenChange(false)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : (reset(), onOpenChange(o)))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar item à espera</DialogTitle>
          <DialogDescription>
            Se o código já existir na espera, a quantidade é somada ao saldo atual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="esp-codigo">Código interno</Label>
            <Input
              id="esp-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex.: 1356"
              className="font-mono"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="esp-box1">Box primário</Label>
              <Input id="esp-box1" value={boxPrimario} onChange={(e) => setBoxPrimario(e.target.value)} placeholder="Ex.: A-12" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="esp-box2">Box secundário (opcional)</Label>
              <Input id="esp-box2" value={boxSecundario} onChange={(e) => setBoxSecundario(e.target.value)} placeholder="Ex.: B-04" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Guardado como</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as EsperaTipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESPERA_TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ESPERA_TIPO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isEmbalagem && (
              <div className="grid gap-2">
                <Label htmlFor="esp-upe">Unidades por {ESPERA_TIPO_LABELS[tipo].toLowerCase()}</Label>
                <Input
                  id="esp-upe"
                  type="number"
                  min={1}
                  value={upe}
                  onChange={(e) => setUpe(e.target.value)}
                  placeholder="Ex.: 15"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="esp-qtd">
                Quantidade {isEmbalagem ? `(em ${ESPERA_TIPO_LABELS[tipo].toLowerCase()}s)` : "(unidades)"}
              </Label>
              <Input
                id="esp-qtd"
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex.: 2"
              />
            </div>
          </div>

          {isEmbalagem && previewUnidades > 0 && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              Total adicionado: <span className="font-semibold text-foreground">{previewUnidades} unidades</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Adiciona mais unidades a um item que já existe (botão verde do resultado).
// Reutiliza a embalagem já cadastrada do item; só pede a quantidade.
function AdicionarExistenteDialog({
  item,
  onOpenChange,
  pending,
  startTransition,
}: {
  item: EsperaItem | null
  onOpenChange: (o: boolean) => void
  pending: boolean
  startTransition: (cb: () => void) => void
}) {
  const [quantidade, setQuantidade] = useState("")

  const tipo = (item?.tipo ?? "unidade") as EsperaTipo
  const isEmbalagem = !!item && item.tipo !== "unidade" && item.unidadesPorEmbalagem > 1
  const previewUnidades = isEmbalagem ? (Number(quantidade) || 0) * item!.unidadesPorEmbalagem : Number(quantidade) || 0

  function submit() {
    if (!item) return
    startTransition(async () => {
      const res = await adicionarEspera({
        codigoInterno: item.codigoInterno,
        boxPrimario: item.boxPrimario,
        boxSecundario: item.boxSecundario ?? undefined,
        tipo,
        unidadesPorEmbalagem: item.unidadesPorEmbalagem,
        quantidade: Number(quantidade),
      })
      if (res.ok) {
        toast.success(`${previewUnidades} un adicionadas a ${item.codigoInterno}`)
        setQuantidade("")
        onOpenChange(false)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => (o ? undefined : (setQuantidade(""), onOpenChange(o)))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar unidades</DialogTitle>
          <DialogDescription>
            {item && (
              <>
                <span className="font-mono font-semibold text-foreground">{item.codigoInterno}</span> — saldo atual:{" "}
                {item.totalUnidades} un.{" "}
                {isEmbalagem && `Cada ${ESPERA_TIPO_LABELS[tipo].toLowerCase()} tem ${item.unidadesPorEmbalagem} un.`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="esp-add-existente">
            Quantidade {isEmbalagem ? `(em ${ESPERA_TIPO_LABELS[tipo].toLowerCase()}s)` : "(unidades)"}
          </Label>
          <Input
            id="esp-add-existente"
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder={isEmbalagem ? "Ex.: 2" : "Ex.: 10"}
            autoFocus
          />
          {isEmbalagem && previewUnidades > 0 && (
            <p className="text-sm text-muted-foreground">
              Total adicionado: <span className="font-semibold text-foreground">{previewUnidades} un</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={submit}
            disabled={pending || (Number(quantidade) || 0) < 1}
          >
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RemoverDialog({
  item,
  onOpenChange,
  pending,
  startTransition,
}: {
  item: EsperaItem | null
  onOpenChange: (o: boolean) => void
  pending: boolean
  startTransition: (cb: () => void) => void
}) {
  const [unidades, setUnidades] = useState("")

  const qtd = Number(unidades) || 0
  const restante = item ? item.totalUnidades - qtd : 0
  const invalido = !item || qtd < 1 || qtd > (item?.totalUnidades ?? 0)

  function submit() {
    if (!item) return
    startTransition(async () => {
      const res = await removerUnidadesEspera(item.id, qtd)
      if (res.ok) {
        toast.success(
          res.zerado ? `${item.codigoInterno} zerado e removido da espera` : `${qtd} un removidas de ${item.codigoInterno}`,
        )
        setUnidades("")
        onOpenChange(false)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => (o ? undefined : (setUnidades(""), onOpenChange(o)))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remover unidades</DialogTitle>
          <DialogDescription>
            {item && (
              <>
                <span className="font-mono font-semibold text-foreground">{item.codigoInterno}</span> — saldo atual:{" "}
                {item.totalUnidades} un. A remoção é sempre em unidades; o registro só sai da espera quando zera.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="esp-remover">Unidades a remover</Label>
          <Input
            id="esp-remover"
            type="number"
            min={1}
            max={item?.totalUnidades}
            value={unidades}
            onChange={(e) => setUnidades(e.target.value)}
            placeholder="Ex.: 16"
            autoFocus
          />
          {qtd > 0 && (
            <p className={cn("text-sm", invalido ? "text-destructive" : "text-muted-foreground")}>
              {qtd > (item?.totalUnidades ?? 0)
                ? "Quantidade acima do saldo disponível."
                : restante <= 0
                  ? "Isso zera o item e o remove da espera."
                  : `Restará ${restante} un.`}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending || invalido}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
