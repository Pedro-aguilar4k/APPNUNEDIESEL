"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, CalendarDays, GripVertical, Hash, ListChecks, Loader2, Plus, Table2, TextCursorInput, Trash2, X } from "lucide-react"
import type { ColunaControle, ModuloControle, ModuloInput, TipoColuna } from "@/app/actions/controle"

const TYPE_INFO: Record<TipoColuna, { label: string; icon: typeof TextCursorInput }> = {
  texto: { label: "Texto", icon: TextCursorInput }, numero: { label: "Número", icon: Hash },
  data: { label: "Data", icon: CalendarDays }, status: { label: "Status", icon: ListChecks },
}

function newColumn(index: number): ColunaControle {
  return { id: `col-${crypto.randomUUID()}`, nome: index === 0 ? "Descrição" : `Coluna ${index + 1}`, tipo: "texto" }
}

export function ModuloDialog({ open, onOpenChange, modulo, saving, onSave }: {
  open: boolean; onOpenChange: (value: boolean) => void; modulo: ModuloControle | null; saving: boolean; onSave: (input: ModuloInput) => void
}) {
  const [step, setStep] = useState(1)
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [colunas, setColunas] = useState<ColunaControle[]>([])

  useEffect(() => {
    if (!open) return
    setStep(modulo ? 2 : 1)
    setTitulo(modulo?.titulo ?? "")
    setDescricao(modulo?.descricao ?? "")
    setColunas(modulo?.colunas.map((column) => ({ ...column, opcoes: [...(column.opcoes ?? [])] })) ?? [newColumn(0), newColumn(1)])
  }, [open, modulo])

  const valid = titulo.trim() && colunas.length > 0 && colunas.every((column) => column.nome.trim())
  function updateColumn(id: string, patch: Partial<ColunaControle>) { setColunas((current) => current.map((column) => column.id === id ? { ...column, ...patch } : column)) }
  function save() {
    const oldRows = modulo?.linhas ?? []
    onSave({ titulo: titulo.trim(), descricao: descricao.trim() || null, colunas, linhas: oldRows.map((row) => ({ ...row, valores: Object.fromEntries(colunas.map((column) => [column.id, row.valores[column.id] ?? ""])) })) })
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Table2 className="size-5" /></span>
          <div><DialogTitle>{modulo ? "Editar configuração" : "Criar tabela livre"}</DialogTitle><DialogDescription>{modulo ? "Altere a estrutura sem perder os dados existentes." : "Prepare o módulo antes de começar a preencher."}</DialogDescription></div>
        </div>
      </DialogHeader>

      <div className="flex items-center gap-2 py-2">
        {["Informações", "Colunas", "Prévia"].map((label, index) => <div key={label} className="flex flex-1 items-center gap-2">
          <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${step >= index + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index + 1}</span>
          <span className="hidden text-sm font-medium sm:inline">{label}</span>{index < 2 && <span className="h-px flex-1 bg-border" />}
        </div>)}
      </div>

      {step === 1 && <div className="flex min-h-72 flex-col justify-center gap-4 rounded-xl border bg-muted/20 p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="table-title">Nome da tabela</Label>
          <Input id="table-title" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Acompanhamento de entregas" autoFocus className="h-11" />
          <p className="text-sm text-muted-foreground">Use um nome direto para sua equipe encontrar este controle rapidamente.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="table-desc">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
          <Textarea id="table-desc" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Explique para que serve este controle e como preenchê-lo." rows={3} />
        </div>
      </div>}

      {step === 2 && <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between"><div><h3 className="font-semibold">Estrutura da planilha</h3><p className="text-sm text-muted-foreground">Escolha o nome e o formato de cada coluna.</p></div><Button type="button" variant="outline" onClick={() => setColunas((current) => [...current, newColumn(current.length)])}><Plus data-icon="inline-start" />Adicionar coluna</Button></div>
        <div className="flex flex-col gap-3">
          {colunas.map((column, index) => { const TypeIcon = TYPE_INFO[column.tipo].icon; return <div key={column.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3"><GripVertical className="mt-3 size-4 text-muted-foreground" /><span className="mt-2.5 text-xs font-bold text-muted-foreground">{index + 1}</span>
              <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
                <Input value={column.nome} onChange={(event) => updateColumn(column.id, { nome: event.target.value })} placeholder="Nome da coluna" />
                <Select value={column.tipo} onValueChange={(value: TipoColuna) => updateColumn(column.id, { tipo: value, opcoes: value === "status" ? column.opcoes ?? ["Pendente", "Concluído"] : undefined })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{Object.entries(TYPE_INFO).map(([value, info]) => <SelectItem key={value} value={value}><span className="flex items-center gap-2"><info.icon className="size-4" />{info.label}</span></SelectItem>)}</SelectGroup></SelectContent></Select>
                <Button type="button" variant="ghost" size="icon" aria-label="Remover coluna" disabled={colunas.length === 1} onClick={() => setColunas((current) => current.filter((item) => item.id !== column.id))}><Trash2 /></Button>
              </div>
            </div>
            {column.tipo === "status" && <StatusOptions options={column.opcoes ?? []} onChange={(opcoes) => updateColumn(column.id, { opcoes })} />}
          </div>})}
        </div>
      </div>}

      {step === 3 && <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div><Badge variant="secondary">Prévia</Badge><h3 className="mt-2 text-xl font-bold">{titulo || "Sua tabela"}</h3><p className="text-sm text-muted-foreground">{colunas.length} coluna{colunas.length === 1 ? "" : "s"} configurada{colunas.length === 1 ? "" : "s"}</p></div>
        <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[560px] text-sm"><thead className="bg-muted/60"><tr>{colunas.map((column) => <th key={column.id} className="border-r px-4 py-3 text-left last:border-r-0"><span className="flex items-center gap-2"><TypeIcon type={column.tipo} />{column.nome || "Sem nome"}</span></th>)}</tr></thead><tbody><tr>{colunas.map((column) => <td key={column.id} className="border-r px-4 py-4 text-muted-foreground last:border-r-0">{column.tipo === "status" ? column.opcoes?.[0] ?? "Selecione" : column.tipo === "data" ? "dd/mm/aaaa" : column.tipo === "numero" ? "0" : "Digite aqui"}</td>)}</tr></tbody></table></div>
      </div>}

      <DialogFooter className="gap-2 sm:justify-between">
        <Button variant="outline" onClick={() => step === 1 ? onOpenChange(false) : setStep((current) => current - 1)} disabled={saving}><ArrowLeft data-icon="inline-start" />{step === 1 ? "Cancelar" : "Voltar"}</Button>
        {step < 3 ? <Button onClick={() => setStep((current) => current + 1)} disabled={step === 1 ? !titulo.trim() : !valid}>Continuar<ArrowRight data-icon="inline-end" /></Button> : <Button onClick={save} disabled={saving || !valid}>{saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Table2 data-icon="inline-start" />}{modulo ? "Salvar configuração" : "Criar e abrir tabela"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

function StatusOptions({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const [draft, setDraft] = useState("")
  function add() { const value = draft.trim(); if (value && !options.includes(value)) onChange([...options, value]); setDraft("") }
  return <div className="ml-9 mt-4 rounded-lg bg-muted/40 p-3"><Label>Opções do status</Label><div className="mt-2 flex flex-wrap gap-2">{options.map((option) => <Badge key={option} variant="outline" className="gap-1">{option}<button type="button" aria-label={`Remover ${option}`} onClick={() => onChange(options.filter((item) => item !== option))}><X className="size-3" /></button></Badge>)}</div><div className="mt-3 flex gap-2"><Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); add() } }} placeholder="Nova opção" /><Button type="button" variant="secondary" onClick={add}>Adicionar</Button></div></div>
}

function TypeIcon({ type }: { type: TipoColuna }) { const Icon = TYPE_INFO[type].icon; return <Icon className="size-4 text-primary" /> }
