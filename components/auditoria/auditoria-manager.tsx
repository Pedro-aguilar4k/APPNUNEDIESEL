"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ClipboardCheck, Plus, MoreVertical, Trash2, ArrowRight, CheckCircle2, Loader2, ListChecks, FileSpreadsheet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { AuditoriaWorkspace } from "@/components/auditoria/auditoria-workspace"
import { criarAuditoria, excluirAuditoria, type Auditoria } from "@/app/actions/auditoria"

export function AuditoriaManager({ auditoriasIniciais }: { auditoriasIniciais: Auditoria[] }) {
  const [auditorias, setAuditorias] = useState<Auditoria[]>(auditoriasIniciais)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nome, setNome] = useState("")
  const [toDelete, setToDelete] = useState<Auditoria | null>(null)
  const [pending, startTransition] = useTransition()

  const active = auditorias.find((a) => a.id === activeId) ?? null

  function handleCriar() {
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) { toast.error("Informe um nome para a auditoria."); return }
    startTransition(async () => {
      const result = await criarAuditoria(nomeLimpo)
      if (!result.ok) { toast.error(result.error); return }
      setDialogOpen(false)
      setNome("")
      toast.success("Auditoria criada.")
      setAuditorias((current) => [result.data.auditoria, ...current])
      setActiveId(result.data.auditoria.id)
    })
  }

  function handleExcluir() {
    if (!toDelete) return
    startTransition(async () => {
      const result = await excluirAuditoria(toDelete.id)
      if (!result.ok) { toast.error(result.error); return }
      setAuditorias((current) => current.filter((a) => a.id !== toDelete.id))
      setToDelete(null)
      toast.success("Auditoria excluída.")
    })
  }

  if (active) {
    return <AuditoriaWorkspace auditoriaId={active.id} onBack={() => setActiveId(null)} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {auditorias.length === 0 ? "Nenhuma auditoria criada ainda." : `${auditorias.length} auditoria(s).`}
        </p>
        <Button onClick={() => setDialogOpen(true)}><Plus />Nova auditoria</Button>
      </div>

      {auditorias.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ClipboardCheck className="size-7" /></span>
            <div>
              <p className="font-medium">Comece uma nova auditoria</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Crie a campanha, faça a contagem física por localização e importe o estoque oficial para comparar ao final.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="mt-2"><Plus />Nova auditoria</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {auditorias.map((auditoria) => (
            <Card
              key={auditoria.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveId(auditoria.id)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveId(auditoria.id) } }}
              className="group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <CardHeader className="border-b bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardCheck className="size-5" /></span>
                  <div className="flex items-center gap-2">
                    {auditoria.status === "finalizada"
                      ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" />Finalizada</Badge>
                      : <Badge className="gap-1"><Loader2 className="size-3" />Em andamento</Badge>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="icon" aria-label={`Opções de ${auditoria.nome}`} className="size-8"><MoreVertical /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenuItem onSelect={() => setToDelete(auditoria)} className="text-destructive focus:text-destructive"><Trash2 />Excluir auditoria</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardTitle className="mt-3 text-lg text-balance">{auditoria.nome}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Criada em {new Date(auditoria.createdAt).toLocaleDateString("pt-BR")}
                  {auditoria.createdByNome ? ` · ${auditoria.createdByNome}` : ""}
                </p>
              </CardHeader>
              <CardContent className="flex items-center gap-5 pt-5">
                <div className="flex items-center gap-2">
                  <ListChecks className="size-4 text-muted-foreground" />
                  <div><strong className="text-xl tabular-nums">{auditoria.totalContagens}</strong><p className="text-xs text-muted-foreground">leituras</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                  <div><strong className="text-xl tabular-nums">{auditoria.totalOficial}</strong><p className="text-xs text-muted-foreground">itens no oficial</p></div>
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t bg-muted/10 py-3 text-sm font-medium text-primary">
                <span>{auditoria.status === "finalizada" ? "Ver relatório" : "Continuar auditoria"}</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova auditoria</DialogTitle>
            <DialogDescription>Dê um nome para identificar esta campanha de balanço (ex.: &quot;Balanço Jan/2026&quot;).</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome-auditoria">Nome da auditoria</Label>
            <Input
              id="nome-auditoria"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex.: Balanço Jan/2026"
              autoFocus
              onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) handleCriar() }}
              className="h-11"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />}Criar e começar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir auditoria</AlertDialogTitle>
            <AlertDialogDescription>Esta ação remove permanentemente a auditoria, suas contagens e o estoque oficial importado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); handleExcluir() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
