"use client"

import { useState, useRef, useCallback } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Upload, FileText, Loader2, Trash2, Eye, ClipboardList, Link2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { SearchBar } from "@/components/search-bar"
import { importNfeXml, listNotas, deleteNota, type NotaListItem } from "@/app/actions/notas"

function fmtDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-BR")
}

function fmtCurrency(v: string | null) {
  if (!v) return "—"
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function ImportManager() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("todos")
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: notasList, mutate, isLoading } = useSWR(
    ["notas", search, status],
    () => listNotas({ search, status }),
  )

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setUploading(true)
      let ok = 0
      let dup = 0
      let fail = 0
      const fileArray = Array.from(files)
      const importadas: { notaId: number; pendentes: number }[] = []
      for (const file of fileArray) {
        try {
          const text = await file.text()
          const res = await importNfeXml(text)
          if (res.ok) {
            if (res.duplicada) {
              dup++
            } else {
              ok++
              importadas.push({ notaId: res.notaId, pendentes: res.pendentes })
              toast.success(`${file.name}: ${res.totalItens} itens, ${res.comMatch} reconhecido(s)`)
            }
          } else {
            fail++
            toast.error(`${file.name}: ${res.error}`)
          }
        } catch {
          fail++
          toast.error(`${file.name}: falha ao ler o arquivo`)
        }
      }
      if (dup) toast.info(`${dup} nota(s) já importada(s) foram ignoradas`)
      setUploading(false)
      mutate()

      // Importou uma única nota nova? Vai direto para a tela de vinculação,
      // onde o usuário informa os códigos internos e confere todos os dados.
      if (importadas.length === 1) {
        router.push(`/importar/${importadas[0].notaId}/vincular`)
      }
    },
    [mutate, router],
  )

  async function handleDelete(id: number) {
    await deleteNota(id)
    toast.success("Nota removida")
    mutate()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        className={`border-2 border-dashed p-8 transition-colors ${
          dragOver ? "border-accent-brand bg-accent-brand/5" : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-brand/10 text-accent-brand">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          </div>
          <div>
            <p className="font-medium text-foreground">
              {uploading ? "Processando NF-e..." : "Arraste arquivos XML aqui"}
            </p>
            <p className="text-sm text-muted-foreground">ou selecione os arquivos da NF-e para importar</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <FileText className="mr-2 h-4 w-4" />
            Selecionar XML
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">Notas importadas</h2>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_conferencia">Em conferência</SelectItem>
                <SelectItem value="conferida">Conferida</SelectItem>
                <SelectItem value="divergente">Divergente</SelectItem>
              </SelectContent>
            </Select>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar nota ou fornecedor..." />
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nota</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !notasList || notasList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhuma nota importada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                notasList.map((n: NotaListItem) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">
                      {n.numero ? `Nº ${n.numero}` : `#${n.id}`}
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
                        {n.origem}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{n.fornecedorNome ?? "—"}</TableCell>
                    <TableCell>{fmtDate(n.dataEmissao)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCurrency(n.valorTotal)}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {n.itensConferidos ?? 0}/{n.totalItens ?? 0}
                    </TableCell>
                    <TableCell>
                      <NotaStatusBadge status={n.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {n.status === "conferida" || n.status === "divergente" ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 px-2.5 text-xs"
                          >
                            <Link href={`/estoque/conferencia/${n.id}`} aria-label="Ver relatório da nota">
                              <ClipboardList className="h-3.5 w-3.5" />
                              Relatório
                            </Link>
                          </Button>
                        ) : n.status === "pendente" ? (
                          <Button
                            asChild
                            size="sm"
                            className="h-8 gap-1.5 px-2.5 text-xs"
                          >
                            <Link href={`/importar/${n.id}/vincular`} aria-label="Vincular produtos da nota">
                              <Link2 className="h-3.5 w-3.5" />
                              {n.itensPendentes > 0 ? `Vincular (${n.itensPendentes})` : "Revisar"}
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                            <Link href={`/estoque/conferencia/${n.id}`} aria-label="Conferir nota">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(n.id)}
                          aria-label="Remover nota"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
