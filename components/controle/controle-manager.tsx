"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { LayoutGrid, Plus, Search, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ModuloCard } from "./modulo-card"
import { ModuloDialog } from "./modulo-dialog"
import { ModuloSpreadsheet } from "./modulo-spreadsheet"
import { createModulo, deleteModulo, updateModulo, type LinhaControle, type ModuloControle, type ModuloInput } from "@/app/actions/controle"

export function ControleManager({ modulosIniciais, canWrite }: { modulosIniciais: ModuloControle[]; canWrite: boolean }) {
  const [modulos, setModulos] = useState(modulosIniciais)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ModuloControle | null>(null)
  const [toDelete, setToDelete] = useState<ModuloControle | null>(null)
  const [pending, startTransition] = useTransition()
  const active = modulos.find((modulo) => modulo.id === activeId) ?? null
  const filtered = modulos.filter((modulo) => modulo.titulo.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")))

  function openNew() { setEditing(null); setDialogOpen(true) }
  function openEdit(modulo: ModuloControle) { setEditing(modulo); setDialogOpen(true) }
  function handleSave(input: ModuloInput) {
    startTransition(async () => {
      const result = editing ? await updateModulo(editing.id, input) : await createModulo(input)
      if (!result.ok || !result.data?.modulo) { toast.error(result.ok ? "Não foi possível salvar." : result.error); return }
      const saved = result.data.modulo
      setModulos((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])
      setActiveId(saved.id); setDialogOpen(false); setEditing(null); toast.success(editing ? "Configuração atualizada." : "Tabela criada com sucesso.")
    })
  }
  async function saveRows(linhas: LinhaControle[]) {
    if (!active) return false
    return new Promise<boolean>((resolve) => startTransition(async () => {
      const result = await updateModulo(active.id, { titulo: active.titulo, colunas: active.colunas, linhas })
      if (!result.ok || !result.data?.modulo) { toast.error(result.ok ? "Não foi possível salvar." : result.error); resolve(false); return }
      setModulos((current) => current.map((item) => item.id === active.id ? result.data!.modulo : item)); toast.success("Planilha salva."); resolve(true)
    }))
  }
  function remove() { if (!toDelete) return; startTransition(async () => { const result = await deleteModulo(toDelete.id); if (!result.ok) { toast.error(result.error); return } setModulos((current) => current.filter((item) => item.id !== toDelete.id)); setActiveId(null); setToDelete(null); toast.success("Tabela removida.") }) }

  if (active) return <><ModuloSpreadsheet modulo={active} canWrite={canWrite} saving={pending} onBack={() => setActiveId(null)} onEditConfig={() => openEdit(active)} onDelete={() => setToDelete(active)} onSave={saveRows} /><ModuloDialog open={dialogOpen} onOpenChange={setDialogOpen} modulo={editing} saving={pending} onSave={handleSave} /><DeleteDialog modulo={toDelete} pending={pending} onClose={() => setToDelete(null)} onConfirm={remove} /></>

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar uma tabela..." className="pl-9" /></div>{canWrite && <Button onClick={openNew}><Plus data-icon="inline-start" />Nova tabela livre</Button>}</div>
    {filtered.length === 0 ? <div className="flex min-h-96 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-muted/15 p-8 text-center"><span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">{query ? <Search className="size-7" /> : <LayoutGrid className="size-7" />}</span><div><h3 className="text-lg font-semibold">{query ? "Nenhuma tabela encontrada" : "Crie seu primeiro controle"}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{query ? "Tente buscar usando outro nome." : "Monte uma planilha personalizada com colunas de texto, número, data e status."}</p></div>{canWrite && !query && <Button onClick={openNew}><Table2 data-icon="inline-start" />Configurar primeira tabela</Button>}</div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((modulo) => <ModuloCard key={modulo.id} modulo={modulo} onOpen={() => setActiveId(modulo.id)} />)}</div>}
    <ModuloDialog open={dialogOpen} onOpenChange={setDialogOpen} modulo={editing} saving={pending} onSave={handleSave} />
    <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir tabela</AlertDialogTitle><AlertDialogDescription>Esta ação remove permanentemente a tabela e todos os dados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); remove() }} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}

function DeleteDialog({ modulo, pending, onClose, onConfirm }: { modulo: ModuloControle | null; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  return <AlertDialog open={!!modulo} onOpenChange={(open) => !open && onClose()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir tabela</AlertDialogTitle><AlertDialogDescription>{modulo ? `A tabela “${modulo.titulo}” e todos os seus dados serão removidos permanentemente.` : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); onConfirm() }} className="bg-destructive text-destructive-foreground">Excluir tabela</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
