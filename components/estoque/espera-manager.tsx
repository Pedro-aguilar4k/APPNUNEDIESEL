"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus, Search, PackageSearch, Minus, MapPin, Loader2 } from "lucide-react"
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
  const [removerAlvo, setRemoverAlvo] = useState<EsperaItem | null>(null)
  const [pending, startTransition] = useTransition()

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return itens
    return itens.filter(
      (i) => i.codigoInterno.toLowerCase().includes(t) || (i.descricao ?? "").toLowerCase().includes(t),
    )
  }, [busca, itens])

  const totalGeral = itens.reduce((s, i) => s + i.totalUnidades, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de busca + ação */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar pelo código do item..."
            className="pl-9"
            aria-label="Pesquisar item na espera"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {itens.length} {itens.length === 1 ? "item" : "itens"} · {totalGeral} un
          </span>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar item
          </Button>
        </div>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <PackageSearch className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">{busca ? "Nenhum item encontrado" : "Espera vazia"}</p>
            <p className="text-sm text-muted-foreground">
              {busca ? "Tente outro código." : "Adicione itens que não couberam na locação normal."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((item) => (
            <EsperaCard key={item.id} item={item} onRemover={() => setRemoverAlvo(item)} />
          ))}
        </div>
      )}

      <AdicionarDialog open={addOpen} onOpenChange={setAddOpen} pending={pending} startTransition={startTransition} />
      <RemoverDialog
        item={removerAlvo}
        onOpenChange={(o) => !o && setRemoverAlvo(null)}
        pending={pending}
        startTransition={startTransition}
      />
    </div>
  )
}

function EsperaCard({ item, onRemover }: { item: EsperaItem; onRemover: () => void }) {
  const r = resumoEmbalagem(item)
  const isEmbalagem = item.tipo !== "unidade" && item.unidadesPorEmbalagem > 1
  const tipo = item.tipo as EsperaTipo

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-foreground">{item.codigoInterno}</p>
          <p className="truncate text-xs text-muted-foreground">{item.descricao ?? "Sem descrição no cadastro"}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {ESPERA_TIPO_LABELS[tipo]}
        </Badge>
      </div>

      {/* Saldo: unidades sempre em destaque */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-foreground">{item.totalUnidades}</span>
        <span className="text-sm text-muted-foreground">unidades</span>
      </div>
      {isEmbalagem && (
        <p className="text-xs text-muted-foreground">
          {r.embalagens} {r.embalagens === 1 ? ESPERA_TIPO_LABELS[tipo].toLowerCase() : `${ESPERA_TIPO_LABELS[tipo].toLowerCase()}s`}
          {" de "}
          {item.unidadesPorEmbalagem} un
          {r.ultimaParcial && <span className="text-amber-600 dark:text-amber-500"> · última parcial ({r.soltasNaUltima} un)</span>}
        </p>
      )}

      {/* Boxes */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{item.boxPrimario}</span>
        {item.boxSecundario && (
          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">{item.boxSecundario}</span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onRemover}>
          <Minus className="mr-1 h-3.5 w-3.5" />
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
  const previewUnidades = isEmbalagem
    ? (Number(quantidade) || 0) * (Number(upe) || 0)
    : Number(quantidade) || 0

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
        toast.success(res.zerado ? `${item.codigoInterno} zerado e removido da espera` : `${qtd} un removidas de ${item.codigoInterno}`)
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
