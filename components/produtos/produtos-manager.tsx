"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  listProdutos,
  createProduto,
  updateProduto,
  deleteProduto,
  type Produto,
  type ProdutoInput,
} from "@/app/actions/produtos"
import { Button } from "@/components/ui/button"
import { AtivoBadge } from "@/components/status-badge"
import { SearchBar } from "@/components/search-bar"
import { PaginationBar } from "@/components/pagination-bar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Plus } from "lucide-react"
import { ProdutoDialog } from "./produto-dialog"

export function ProdutosManager({ canManage }: { canManage: boolean }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Produto | null>(null)

  const { data, isLoading, mutate } = useSWR(["produtos", q, page], () => listProdutos({ q, page }), {
    keepPreviousData: true,
  })

  const rows = data?.rows ?? []

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(p: Produto) {
    setEditing(p)
    setDialogOpen(true)
  }

  async function handleSubmit(input: ProdutoInput) {
    const res = editing ? await updateProduto(editing.id, input) : await createProduto(input)
    if (res.ok) {
      toast.success(editing ? "Produto atualizado." : "Produto criado.")
      setDialogOpen(false)
      mutate()
    } else {
      toast.error(res.error)
    }
    return res.ok
  }

  async function handleDelete(p: Produto) {
    if (!confirm(`Remover o produto "${p.descricao}"?`)) return
    const res = await deleteProduto(p.id)
    if (res.ok) {
      toast.success("Produto removido.")
      mutate()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
          placeholder="Buscar por descrição, código ou EAN..."
        />
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo produto
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>EAN</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="w-12 text-right">Ações</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.codigoInterno}</TableCell>
                  <TableCell className="font-medium">{p.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{p.fabricante ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.codigoBarras ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.estoqueAtual ?? 0}</TableCell>
                  <TableCell>
                    <AtivoBadge ativo={p.ativo} />
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p)}>
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <ProdutoDialog open={dialogOpen} onOpenChange={setDialogOpen} produto={editing} onSubmit={handleSubmit} />
    </>
  )
}
