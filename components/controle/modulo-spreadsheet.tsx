"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, CalendarDays, Check, CloudCheck, Hash, ListChecks, Loader2, Plus, Table2, TextCursorInput, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ColunaControle, LinhaControle, ModuloControle, TipoColuna } from "@/app/actions/controle"

const ICONS: Record<TipoColuna, typeof TextCursorInput> = { texto: TextCursorInput, numero: Hash, data: CalendarDays, status: ListChecks }

type SaveStatus = "idle" | "saving" | "saved"

export function ModuloSpreadsheet({ modulo, canWrite, onBack, onSave }: {
  modulo: ModuloControle
  canWrite: boolean
  onBack: () => void
  onSave: (linhas: LinhaControle[]) => Promise<boolean>
}) {
  const [linhas, setLinhas] = useState<LinhaControle[]>(modulo.linhas)
  const [status, setStatus] = useState<SaveStatus>("idle")
  const skipRef = useRef(true)
  const linhasRef = useRef(linhas)
  const saveRef = useRef(onSave)
  linhasRef.current = linhas
  saveRef.current = onSave

  const completed = useMemo(() => linhas.filter((row) => modulo.colunas.some((column) => row.valores[column.id]?.trim())).length, [linhas, modulo.colunas])

  // Salva automaticamente (com debounce) sempre que os dados mudam.
  useEffect(() => {
    if (!canWrite) return
    if (skipRef.current) { skipRef.current = false; return }
    setStatus("saving")
    const timer = setTimeout(async () => {
      const ok = await saveRef.current(linhasRef.current)
      setStatus(ok ? "saved" : "idle")
    }, 700)
    return () => clearTimeout(timer)
  }, [linhas, canWrite])

  function addRow() {
    setLinhas((current) => [...current, { id: `row-${crypto.randomUUID()}`, valores: Object.fromEntries(modulo.colunas.map((column) => [column.id, ""])) }])
  }
  function setCell(rowId: string, columnId: string, value: string) {
    setLinhas((current) => current.map((row) => row.id === rowId ? { ...row, valores: { ...row.valores, [columnId]: value } } : row))
  }
  function removeRow(rowId: string) {
    setLinhas((current) => current.filter((row) => row.id !== rowId))
    toast.info("Linha removida.")
  }

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Voltar para tabelas"><ArrowLeft /></Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-balance">{modulo.titulo}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{modulo.descricao || "Edite as células diretamente. Tudo é salvo automaticamente."}</p>
        </div>
      </div>
      <SaveIndicator status={status} />
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={Table2} label="Linhas preenchidas" value={completed} />
      <Metric icon={TextCursorInput} label="Colunas" value={modulo.colunas.length} />
      <Metric icon={Check} label="Total de linhas" value={linhas.length} />
    </div>

    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/20">
        <div><CardTitle className="text-base">Dados da planilha</CardTitle><p className="mt-1 text-xs text-muted-foreground">Clique em qualquer célula para editar.</p></div>
        {canWrite && <Button variant="outline" size="sm" onClick={addRow}><Plus data-icon="inline-start" />Adicionar linha</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[720px]">
          <TableHeader className="sticky top-0 bg-muted/70"><TableRow>{modulo.colunas.map((column) => { const Icon = ICONS[column.tipo]; return <TableHead key={column.id} className="min-w-44 border-r px-3 last:border-r-0"><span className="flex items-center gap-2"><Icon className="size-4 text-primary" />{column.nome}</span></TableHead> })}{canWrite && <TableHead className="w-14 text-center">Ações</TableHead>}</TableRow></TableHeader>
          <TableBody>{linhas.length === 0
            ? <TableRow><TableCell colSpan={modulo.colunas.length + (canWrite ? 1 : 0)} className="h-56 text-center"><div className="flex flex-col items-center gap-3"><span className="flex size-12 items-center justify-center rounded-full bg-muted"><Table2 className="size-6 text-muted-foreground" /></span><div><p className="font-medium">Sua tabela está pronta</p><p className="text-sm text-muted-foreground">Adicione a primeira linha para começar.</p></div>{canWrite && <Button onClick={addRow}><Plus data-icon="inline-start" />Adicionar primeira linha</Button>}</div></TableCell></TableRow>
            : linhas.map((row, index) => <TableRow key={row.id} className="odd:bg-muted/15">{modulo.colunas.map((column) => <TableCell key={column.id} className="border-r p-1.5 last:border-r-0"><CellEditor column={column} value={row.valores[column.id] ?? ""} disabled={!canWrite} onChange={(value) => setCell(row.id, column.id, value)} /></TableCell>)}{canWrite && <TableCell className="text-center"><Button variant="ghost" size="icon" aria-label={`Excluir linha ${index + 1}`} onClick={() => removeRow(row.id)}><Trash2 /></Button></TableCell>}</TableRow>)}</TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") return <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Salvando...</span>
  if (status === "saved") return <span className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"><CloudCheck className="size-4" />Salvo automaticamente</span>
  return <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground"><CloudCheck className="size-4" />Salvamento automático</span>
}

function CellEditor({ column, value, disabled, onChange }: { column: ColunaControle; value: string; disabled: boolean; onChange: (value: string) => void }) {
  if (column.tipo === "status") return <Select value={value || undefined} onValueChange={onChange} disabled={disabled}><SelectTrigger className="h-9 border-0 bg-transparent shadow-none"><SelectValue placeholder="Selecionar status" /></SelectTrigger><SelectContent><SelectGroup>{(column.opcoes ?? []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectGroup></SelectContent></Select>
  return <Input type={column.tipo === "data" ? "date" : column.tipo === "numero" ? "number" : "text"} inputMode={column.tipo === "numero" ? "decimal" : undefined} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={column.tipo === "numero" ? "0" : "Digite..."} className="h-9 border-0 bg-transparent shadow-none focus-visible:bg-background focus-visible:ring-1" />
}

function Metric({ icon: Icon, label, value }: { icon: typeof Table2; label: string; value: string | number }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>
}
