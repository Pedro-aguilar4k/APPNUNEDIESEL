"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  listFornecedores,
  createFornecedor,
  updateFornecedor,
  deleteFornecedor,
  type Fornecedor,
  type FornecedorInput,
} from "@/app/actions/fornecedores"
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
import { FornecedorDialog } from "./fornecedor-dialog"

function formatCnpj(cnpj: string | null) {
  if (!cnpj) return "—"
  if (cnpj.length !== 14) return cnpj
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}

export function FornecedoresManager({ canManage }: { canManage: boolean }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Fornecedor | null>(null)

  const { data, isLoading, mutate } = useSWR(["fornecedores", q, page], () => listFornecedores({ q, page }), {
    keepPreviousData: true,
  })

  const rows = data?.rows ?? []

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(f: Fornecedor) {
    setEditing(f)
    setDialogOpen(true)
  }

  async function handleSubmit(input: FornecedorInput) {
    const res = editing ? await updateFornecedor(editing.id, input) : await createFornecedor(input)
    if (res.ok) {
      toast.success(editing ? "Fornecedor atualizado." : "Fornecedor criado.")
      setDialogOpen(false)
      mutate()
    } else {
      toast.error(res.error)
    }
    return res.ok
  }

  async function handleDelete(f: Fornecedor) {
    if (!confirm(`Remover o fornecedor "${f.razaoSocial}"?`)) return
    const res = await deleteFornecedor(f.id)
    if (res.ok) {
      toast.success("Fornecedor removido.")
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
          placeholder="Buscar por razão social, fantasia ou CNPJ..."
        />
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo fornecedor
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão social</TableHead>
              <TableHead>Nome fantasia</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
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
                  Nenhum fornecedor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.razaoSocial}</TableCell>
                  <TableCell className="text-muted-foreground">{f.nomeFantasia ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{formatCnpj(f.cnpj)}</TableCell>
                  <TableCell className="text-muted-foreground">{f.email ?? f.telefone ?? "—"}</TableCell>
                  <TableCell>
                    <AtivoBadge ativo={f.ativo} />
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
                          <DropdownMenuItem onClick={() => openEdit(f)}>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(f)}>
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

      <FornecedorDialog open={dialogOpen} onOpenChange={setDialogOpen} fornecedor={editing} onSubmit={handleSubmit} />
    </>
  )
}
