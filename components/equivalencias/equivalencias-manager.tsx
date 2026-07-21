"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { listEquivalencias, deleteEquivalencia, type Equivalencia } from "@/app/actions/equivalencias"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchBar } from "@/components/search-bar"
import { PaginationBar } from "@/components/pagination-bar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, ArrowRight } from "lucide-react"

export function EquivalenciasManager({ canManage }: { canManage: boolean }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading, mutate } = useSWR(["equivalencias", q, page], () => listEquivalencias({ q, page }), {
    keepPreviousData: true,
  })

  const rows = data?.rows ?? []

  async function handleDelete(e: Equivalencia) {
    if (!confirm("Remover esta equivalência? O aprendizado deste vínculo será perdido.")) return
    const res = await deleteEquivalencia(e.id)
    if (res.ok) {
      toast.success("Equivalência removida.")
      mutate()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <>
      <div className="mb-4">
        <SearchBar
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
          placeholder="Buscar por descrição, código do fornecedor ou produto..."
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição do fornecedor</TableHead>
              <TableHead className="w-8" />
              <TableHead>Produto interno</TableHead>
              <TableHead>Cód. fornecedor</TableHead>
              <TableHead className="text-right">Usos</TableHead>
              {canManage ? <TableHead className="w-12 text-right">Ações</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhuma equivalência aprendida ainda. Elas são criadas ao vincular itens de NF-e a produtos.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-xs">
                    <span className="line-clamp-2 text-sm">{e.descricaoFornecedor ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-accent-brand" aria-hidden="true" />
                  </TableCell>
                  <TableCell className="font-medium">{e.produtoDescricao ?? "(produto removido)"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.codigoFornecedor ?? e.ean ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="tabular-nums">
                      {e.vezesUsado}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(e)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Remover</span>
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationBar
          page={data?.page ?? 1}
          pageSize={data?.pageSize ?? 20}
          total={data?.total ?? 0}
          onPage={setPage}
        />
      </div>
    </>
  )
}
