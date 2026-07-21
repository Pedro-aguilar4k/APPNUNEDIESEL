"use client"

import useSWR from "swr"
import { FileText, Printer } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listTodosRelatorios } from "@/app/actions/relatorio-conferencia"
import { baixarRelatorioTxt, abrirRelatorioPdf } from "@/lib/relatorio-download"

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export function RelatoriosConferenciaList({ numero }: { numero: string }) {
  const { data, isLoading } = useSWR(["relatorios-conferencia", numero], () =>
    listTodosRelatorios({ numero: numero || undefined }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Relatórios de conferência gerados</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nota</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Estoquista</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Gerado em</TableHead>
                <TableHead className="text-right">Documentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !data?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhum relatório de conferência gerado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">Nº {r.numeroNota ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {r.fornecedorNome ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.estoquista}</TableCell>
                    <TableCell>
                      <span
                        className={
                          r.status === "divergente"
                            ? "text-sm font-medium text-destructive"
                            : "text-sm font-medium text-success"
                        }
                      >
                        {r.status === "divergente"
                          ? `${r.itensDivergentes} divergência(s)`
                          : "Sem divergências"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDateTime(r.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 bg-transparent"
                          onClick={() => baixarRelatorioTxt(r.id, r.numeroNota)}
                        >
                          <FileText className="h-4 w-4" aria-hidden="true" /> TXT
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={() => abrirRelatorioPdf(r.id)}>
                          <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
