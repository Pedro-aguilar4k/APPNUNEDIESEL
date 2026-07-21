"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NotaStatusBadge } from "@/components/status-badge"
import { getRelatorioNotas } from "@/app/actions/relatorios"
import { RelatoriosConferenciaList } from "@/components/relatorios/relatorios-conferencia-list"

type Filtros = { numero: string; status: string; de: string; ate: string }

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR")
}
function fmtMoeda(v: string | null) {
  if (!v) return "—"
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function RelatoriosManager() {
  const [filtros, setFiltros] = useState<Filtros>({ numero: "", status: "todos", de: "", ate: "" })
  const [applied, setApplied] = useState<Filtros>(filtros)
  const [, startTransition] = useTransition()

  const { data, isLoading } = useSWR(["relatorio", applied], () =>
    getRelatorioNotas({
      numero: applied.numero || undefined,
      status: applied.status,
      de: applied.de || undefined,
      ate: applied.ate || undefined,
    }),
  )

  function aplicar() {
    startTransition(() => setApplied({ ...filtros }))
  }

  function exportarCsv() {
    if (!data?.notas.length) return
    const header = ["Numero", "Fornecedor", "CNPJ", "Status", "Itens", "Conferidos", "Valor", "Data"]
    const linhas = data.notas.map((n) => [
      n.numero ?? "",
      n.fornecedorNome ?? "",
      n.fornecedorCnpj ?? "",
      n.status,
      String(n.totalItens),
      String(n.itensConferidos),
      n.valorTotal ?? "",
      fmtDate(n.createdAt),
    ])
    const csv = [header, ...linhas]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relatorio-notas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const resumo = data?.resumo

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Número da nota</label>
            <Input
              type="search"
              inputMode="numeric"
              placeholder="Ex: 1234"
              value={filtros.numero}
              onChange={(e) => setFiltros((f) => ({ ...f, numero: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) aplicar()
              }}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={filtros.status} onValueChange={(v) => setFiltros((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_conferencia">Em conferência</SelectItem>
                <SelectItem value="conferida">Conferida</SelectItem>
                <SelectItem value="divergente">Divergente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <Input
              type="date"
              value={filtros.de}
              onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Input
              type="date"
              value={filtros.ate}
              onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))}
              className="w-40"
            />
          </div>
          <Button onClick={aplicar} className="gap-2">
            <Search className="h-4 w-4" aria-hidden="true" /> Filtrar
          </Button>
          <Button
            variant="outline"
            onClick={exportarCsv}
            disabled={!data?.notas.length}
            className="ml-auto gap-2 bg-transparent"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {resumo && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{resumo.total}</p>
              <p className="text-sm text-muted-foreground">Notas no período</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold tabular-nums text-success">{resumo.conferidas}</p>
              <p className="text-sm text-muted-foreground">Conferidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold tabular-nums text-destructive">{resumo.divergentes}</p>
              <p className="text-sm text-muted-foreground">Divergentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{resumo.itens}</p>
              <p className="text-sm text-muted-foreground">Itens totais</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nota</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !data?.notas.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhuma nota encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                data.notas.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium text-foreground">Nº {n.numero ?? "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">
                      {n.fornecedorNome ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {n.itensConferidos}/{n.totalItens}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{fmtMoeda(n.valorTotal)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(n.createdAt)}</TableCell>
                    <TableCell>
                      <NotaStatusBadge status={n.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <RelatoriosConferenciaList numero={applied.numero} />
    </div>
  )
}
