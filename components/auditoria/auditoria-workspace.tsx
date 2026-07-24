"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { ArrowLeft, ScanLine, FileSpreadsheet, LayoutDashboard, FileCheck2, Loader2, CheckCircle2, RotateCcw, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { AuditoriaContagem } from "@/components/auditoria/auditoria-contagem"
import { AuditoriaImportacao } from "@/components/auditoria/auditoria-importacao"
import { AuditoriaDashboard } from "@/components/auditoria/auditoria-dashboard"
import { AuditoriaRelatorio } from "@/components/auditoria/auditoria-relatorio"
import {
  getAuditoria,
  finalizarAuditoria,
  reabrirAuditoria,
  type Auditoria,
  type Contagem,
  type LinhaOficial,
} from "@/app/actions/auditoria"

type Dados = { auditoria: Auditoria; contagens: Contagem[]; oficial: LinhaOficial[] }

export function AuditoriaWorkspace({ auditoriaId, onBack }: { auditoriaId: number; onBack: () => void }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("contagem")
  const [confirmFinalizar, setConfirmFinalizar] = useState(false)
  const [pending, startTransition] = useTransition()

  const recarregar = useCallback(async () => {
    const result = await getAuditoria(auditoriaId)
    if (result) setDados(result)
    setLoading(false)
  }, [auditoriaId])

  useEffect(() => { void recarregar() }, [recarregar])

  function handleFinalizar() {
    startTransition(async () => {
      const result = await finalizarAuditoria(auditoriaId)
      if (!result.ok) { toast.error(result.error); setConfirmFinalizar(false); return }
      toast.success("Auditoria finalizada. Relatório gerado.")
      setConfirmFinalizar(false)
      await recarregar()
      setTab("relatorio")
    })
  }

  function handleReabrir() {
    startTransition(async () => {
      const result = await reabrirAuditoria(auditoriaId)
      if (!result.ok) { toast.error(result.error); return }
      toast.success("Auditoria reaberta.")
      await recarregar()
    })
  }

  if (loading || !dados) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const finalizada = dados.auditoria.status === "finalizada"

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Voltar"><ArrowLeft /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-balance">{dados.auditoria.nome}</h2>
              {finalizada
                ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" />Finalizada</Badge>
                : <Badge className="gap-1"><Loader2 className="size-3" />Em andamento</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {dados.contagens.length} leitura(s) · {dados.oficial.length} item(ns) no estoque oficial
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {finalizada
            ? <Button variant="outline" onClick={handleReabrir} disabled={pending}><RotateCcw />Reabrir</Button>
            : <Button onClick={() => setConfirmFinalizar(true)} disabled={pending}><FileCheck2 />Finalizar e comparar</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="contagem" disabled={finalizada}><ScanLine className="size-4" />Contagem</TabsTrigger>
          <TabsTrigger value="oficial"><FileSpreadsheet className="size-4" />Estoque oficial</TabsTrigger>
          <TabsTrigger value="dashboard"><LayoutDashboard className="size-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="relatorio"><FileCheck2 className="size-4" />Relatório</TabsTrigger>
        </TabsList>

        <TabsContent value="contagem" className="mt-5">
          {finalizada ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
              <Lock className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Auditoria finalizada. Reabra para registrar novas contagens.</p>
            </div>
          ) : (
            <AuditoriaContagem
              auditoriaId={auditoriaId}
              contagens={dados.contagens}
              onChange={recarregar}
            />
          )}
        </TabsContent>

        <TabsContent value="oficial" className="mt-5">
          <AuditoriaImportacao auditoriaId={auditoriaId} oficial={dados.oficial} onChange={recarregar} />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-5">
          <AuditoriaDashboard contagens={dados.contagens} oficial={dados.oficial} />
        </TabsContent>

        <TabsContent value="relatorio" className="mt-5">
          <AuditoriaRelatorio
            auditoria={dados.auditoria}
            contagens={dados.contagens}
            oficial={dados.oficial}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmFinalizar} onOpenChange={setConfirmFinalizar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar auditoria</AlertDialogTitle>
            <AlertDialogDescription>
              A contagem física será comparada ao estoque oficial importado e o relatório de divergências será gerado.
              Você poderá reabrir depois se precisar ajustar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); handleFinalizar() }}>Finalizar e comparar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
