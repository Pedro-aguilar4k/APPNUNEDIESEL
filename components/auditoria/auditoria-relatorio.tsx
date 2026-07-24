"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { FileSpreadsheet, FileText, Download, CheckCircle2, ArrowUp, ArrowDown, PackageX, HelpCircle, MapPin, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { construirResumoCliente, STATUS_LABEL } from "@/components/auditoria/auditoria-resumo"
import type { Auditoria, Contagem, LinhaOficial, ItemRelatorio, StatusItem } from "@/app/actions/auditoria"

const STATUS_BADGE: Record<StatusItem, { className: string; icon: typeof CheckCircle2 }> = {
  correto: { className: "bg-success/10 text-success", icon: CheckCircle2 },
  sobra: { className: "bg-warning/10 text-warning", icon: ArrowUp },
  falta: { className: "bg-destructive/10 text-destructive", icon: ArrowDown },
  sem_cadastro: { className: "bg-muted text-muted-foreground", icon: HelpCircle },
  nao_encontrado: { className: "bg-destructive/10 text-destructive", icon: PackageX },
}

function StatusBadge({ status }: { status: StatusItem }) {
  const cfg = STATUS_BADGE[status]
  const Icon = cfg.icon
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}><Icon className="size-3" />{STATUS_LABEL[status]}</span>
}

function ResumoStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <strong className={`text-2xl tabular-nums ${tone ?? ""}`}>{value}</strong>
      <p className="mt-1 text-xs text-muted-foreground text-pretty">{label}</p>
    </div>
  )
}

export function AuditoriaRelatorio({
  auditoria,
  contagens,
  oficial,
}: {
  auditoria: Auditoria
  contagens: Contagem[]
  oficial: LinhaOficial[]
}) {
  const resumo = useMemo(() => construirResumoCliente(oficial, contagens), [oficial, contagens])
  const [tab, setTab] = useState<"todos" | StatusItem>("todos")
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const itensFiltrados = tab === "todos" ? resumo.itens : resumo.itens.filter((i) => i.status === tab)

  function exportarXlsx() {
    const linhas = resumo.itens.map((i) => ({
      Código: i.codigo,
      Descrição: i.descricao ?? "",
      "Qtd Sistema": i.quantidadeSistema,
      "Qtd Contada": i.quantidadeContada,
      Diferença: i.diferenca,
      Status: STATUS_LABEL[i.status],
      Localizações: i.localizacoes.map((l) => `${l.local} (${l.quantidade})`).join(" | "),
      Observações: i.observacoes.join(" | "),
    }))
    const ws = XLSX.utils.json_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Divergências")

    const resumoWs = XLSX.utils.json_to_sheet([
      { Indicador: "Total importados", Valor: resumo.totalImportados },
      { Indicador: "Total conferidos", Valor: resumo.totalConferidos },
      { Indicador: "Corretos", Valor: resumo.corretos },
      { Indicador: "Sobras", Valor: resumo.sobras },
      { Indicador: "Faltas", Valor: resumo.faltas },
      { Indicador: "Não encontrados", Valor: resumo.naoEncontrados },
      { Indicador: "Sem cadastro no oficial", Valor: resumo.semCadastro },
      { Indicador: "Em múltiplas localizações", Valor: resumo.multiplasLocalizacoes },
      { Indicador: "Total de divergências", Valor: resumo.totalDivergencias },
    ])
    XLSX.utils.book_append_sheet(wb, resumoWs, "Resumo")

    XLSX.writeFile(wb, `auditoria-${auditoria.nome.replace(/\s+/g, "-").toLowerCase()}.xlsx`)
    toast.success("Planilha gerada.")
  }

  async function exportarPdf() {
    setGerandoPdf(true)
    try {
      const res = await fetch(`/api/auditoria/${auditoria.id}/pdf`, { credentials: "include" })
      if (!res.ok) { toast.error("Não foi possível gerar o PDF."); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const win = window.open(url, "_blank")
      if (!win) {
        const a = document.createElement("a")
        a.href = url
        a.download = `auditoria-${auditoria.id}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error("Falha ao gerar o PDF.")
    } finally {
      setGerandoPdf(false)
    }
  }

  if (oficial.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <FileSpreadsheet className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Importe o estoque oficial na aba &quot;Estoque oficial&quot; para gerar o relatório de divergências.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Resumo geral</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportarXlsx}><FileSpreadsheet />Exportar planilha</Button>
          <Button variant="outline" onClick={exportarPdf} disabled={gerandoPdf}>{gerandoPdf ? <Loader2 className="animate-spin" /> : <FileText />}Exportar PDF</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <ResumoStat label="Total importados" value={resumo.totalImportados} />
        <ResumoStat label="Total conferidos" value={resumo.totalConferidos} />
        <ResumoStat label="Corretos" value={resumo.corretos} tone="text-success" />
        <ResumoStat label="Total de divergências" value={resumo.totalDivergencias} tone="text-destructive" />
        <ResumoStat label="Sobras" value={resumo.sobras} tone="text-warning" />
        <ResumoStat label="Faltas" value={resumo.faltas} tone="text-destructive" />
        <ResumoStat label="Não encontrados" value={resumo.naoEncontrados} tone="text-destructive" />
        <ResumoStat label="Sem cadastro no oficial" value={resumo.semCadastro} />
      </div>

      {resumo.multiplasLocalizacoes > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <MapPin className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">{resumo.multiplasLocalizacoes}</strong> produto(s) encontrados em múltiplas localizações. Isso é apenas informativo, não é considerado erro.
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base">Detalhamento por produto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <div className="border-b px-4 pt-4">
              <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                <TabsTrigger value="todos">Todos ({resumo.itens.length})</TabsTrigger>
                <TabsTrigger value="falta">Faltas ({resumo.faltas})</TabsTrigger>
                <TabsTrigger value="sobra">Sobras ({resumo.sobras})</TabsTrigger>
                <TabsTrigger value="nao_encontrado">Não encontrados ({resumo.naoEncontrados})</TabsTrigger>
                <TabsTrigger value="sem_cadastro">Sem cadastro ({resumo.semCadastro})</TabsTrigger>
                <TabsTrigger value="correto">Corretos ({resumo.corretos})</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value={tab} className="mt-0">
              <TabelaItens itens={itensFiltrados} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function TabelaItens({ itens }: { itens: ItemRelatorio[] }) {
  if (itens.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Nenhum item nesta categoria.</div>
  }
  return (
    <div className="max-h-[520px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Sistema</TableHead>
            <TableHead className="text-right">Contado</TableHead>
            <TableHead className="text-right">Diferença</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Localizações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((i) => (
            <TableRow key={i.codigo}>
              <TableCell className="font-mono font-medium">{i.codigo}</TableCell>
              <TableCell className="max-w-48 truncate text-sm text-muted-foreground">{i.descricao ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{i.quantidadeSistema}</TableCell>
              <TableCell className="text-right tabular-nums">{i.quantidadeContada}</TableCell>
              <TableCell className={`text-right font-medium tabular-nums ${i.diferenca < 0 ? "text-destructive" : i.diferenca > 0 ? "text-warning" : "text-muted-foreground"}`}>
                {i.diferenca > 0 ? `+${i.diferenca}` : i.diferenca}
              </TableCell>
              <TableCell><StatusBadge status={i.status} /></TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {i.localizacoes.length === 0
                    ? <span className="text-xs text-muted-foreground">—</span>
                    : i.localizacoes.map((l) => (
                        <Badge key={l.local} variant="outline" className="gap-1 font-mono text-xs">
                          {i.multiplasLocalizacoes && <AlertTriangle className="size-3 text-amber-600 dark:text-amber-500" />}
                          {l.local} ({l.quantidade})
                        </Badge>
                      ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
