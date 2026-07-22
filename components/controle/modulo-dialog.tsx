"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Minus, Loader2 } from "lucide-react"
import type { ModuloControle, ModuloInput } from "@/app/actions/controle"

const MAX_COLS = 6
const MAX_ROWS = 30

function makeGrid(cols: number, rows: number, colunas?: string[], linhas?: string[][]) {
  const heads = Array.from({ length: cols }, (_, i) => colunas?.[i] ?? (i === 0 ? "Categoria" : `Série ${i}`))
  const body = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => linhas?.[r]?.[c] ?? ""),
  )
  return { heads, body }
}

export function ModuloDialog({
  open,
  onOpenChange,
  modulo,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  modulo: ModuloControle | null
  saving: boolean
  onSave: (input: ModuloInput) => void
}) {
  const [titulo, setTitulo] = useState("")
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(4)
  const [heads, setHeads] = useState<string[]>([])
  const [body, setBody] = useState<string[][]>([])

  // Reinicializa o formulário sempre que abrir (novo ou edição).
  useEffect(() => {
    if (!open) return
    const c = modulo ? Math.max(2, modulo.colunas.length) : 3
    const r = modulo ? Math.max(1, modulo.linhas.length) : 4
    const grid = makeGrid(c, r, modulo?.colunas, modulo?.linhas)
    setTitulo(modulo?.titulo ?? "")
    setCols(c)
    setRows(r)
    setHeads(grid.heads)
    setBody(grid.body)
  }, [open, modulo])

  function resize(nextCols: number, nextRows: number) {
    const c = Math.min(MAX_COLS, Math.max(2, nextCols))
    const r = Math.min(MAX_ROWS, Math.max(1, nextRows))
    const grid = makeGrid(c, r, heads, body)
    setCols(c)
    setRows(r)
    setHeads(grid.heads)
    setBody(grid.body)
  }

  function setHead(i: number, v: string) {
    setHeads((prev) => prev.map((h, idx) => (idx === i ? v : h)))
  }

  function setCell(r: number, c: number, v: string) {
    setBody((prev) => prev.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)))
  }

  function handleSave() {
    onSave({ titulo, colunas: heads, linhas: body })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{modulo ? "Editar módulo" : "Novo módulo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="modulo-titulo">Título do módulo</Label>
            <Input
              id="modulo-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Entradas por fornecedor"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <Stepper label="Colunas" value={cols} min={2} max={MAX_COLS} onChange={(v) => resize(v, rows)} />
            <Stepper label="Linhas" value={rows} min={1} max={MAX_ROWS} onChange={(v) => resize(cols, v)} />
          </div>

          <div className="space-y-1.5">
            <Label>Dados</Label>
            <p className="text-xs text-muted-foreground">
              A primeira coluna é o rótulo de cada linha. As demais são valores numéricos exibidos no gráfico.
            </p>
            <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    {heads.map((h, i) => (
                      <th key={i} className="border-b border-border p-1.5">
                        <Input
                          value={h}
                          onChange={(e) => setHead(i, e.target.value)}
                          className="h-8 border-0 bg-transparent text-xs font-semibold shadow-none focus-visible:ring-1"
                          placeholder={i === 0 ? "Rótulo" : `Série ${i}`}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="border-b border-border/60 p-1">
                          <Input
                            value={cell}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            inputMode={c === 0 ? "text" : "decimal"}
                            className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-1"
                            placeholder={c === 0 ? "Rótulo" : "0"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !titulo.trim()} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {modulo ? "Salvar alterações" : "Criar módulo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={`Diminuir ${label.toLowerCase()}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center text-sm font-semibold tabular-nums">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={`Aumentar ${label.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
