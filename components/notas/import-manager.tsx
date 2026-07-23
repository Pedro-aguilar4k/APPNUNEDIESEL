"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import useSWR from "swr"
import Link from "next/link"
import {
  Upload,
  FileText,
  Loader2,
  Trash2,
  Eye,
  ClipboardList,
  Link2,
  PackagePlus,
  Lightbulb,
  CheckCircle2,
  PieChart,
  Building2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchBar } from "@/components/search-bar"
import { importNfeXml, listNotas, deleteNota, type NotaListItem } from "@/app/actions/notas"

function fmtDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-BR")
}

function fmtTime(d: Date | string | null) {
  if (!d) return ""
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function fmtCurrency(v: string | null) {
  if (!v) return "—"
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function isToday(d: Date | string | null) {
  if (!d) return false
  const date = new Date(d)
  const now = new Date()
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

// Status em formato "ponto + rótulo", como no design.
const STATUS_DOT: Record<string, { label: string; dot: string; text: string }> = {
  pendente: { label: "Pendente", dot: "bg-warning", text: "text-warning" },
  em_conferencia: { label: "Em conferência", dot: "bg-primary", text: "text-primary" },
  conferida: { label: "Conferência concluída", dot: "bg-success", text: "text-success" },
  divergente: { label: "Divergente", dot: "bg-destructive", text: "text-destructive" },
  reconhecida: { label: "Reconhecida", dot: "bg-success", text: "text-success" },
  erro: { label: "Erro na importação", dot: "bg-destructive", text: "text-destructive" },
}

function StatusDot({ status }: { status: string }) {
  const s = STATUS_DOT[status] ?? STATUS_DOT.pendente
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${s.text}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

type Modo = "importacao" | "reconhecimento"

const TEXTOS: Record<
  Modo,
  {
    origem: "xml" | "reconhecimento"
    vincularBase: string
    dropTitulo: string
    dropSub: string
    listaTitulo: string
    vazio: string
    acaoVincular: string
    dica: string
  }
> = {
  importacao: {
    origem: "xml",
    vincularBase: "/importar",
    dropTitulo: "Arraste e solte o arquivo XML aqui",
    dropSub: "ou selecione o arquivo da NF-e para importar",
    listaTitulo: "Notas importadas",
    vazio: "Nenhuma nota importada ainda.",
    acaoVincular: "Vincular",
    dica: "Importe o XML da NF-e para iniciar a conferência automaticamente.",
  },
  reconhecimento: {
    origem: "reconhecimento",
    vincularBase: "/reconhecimento",
    dropTitulo: "Arraste o XML para absorver os produtos",
    dropSub: "os itens da nota entram no cadastro assim que você informa o código interno",
    listaTitulo: "Notas de reconhecimento",
    vazio: "Nenhuma nota reconhecida ainda. Importe um XML para absorver os produtos.",
    acaoVincular: "Reconhecer",
    dica: "Cada XML absorvido cadastra os produtos direto no seu estoque.",
  },
}

export function ImportManager({ modo = "importacao" }: { modo?: Modo }) {
  const t = TEXTOS[modo]
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("todos")
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    data: notasList,
    mutate,
    isLoading,
  } = useSWR(["notas", modo, search, status], () => listNotas({ search, status, origem: t.origem }))

  // Estatísticas derivadas da lista carregada.
  const stats = useMemo(() => {
    const lista = notasList ?? []
    const hoje = lista.filter((n) => isToday(n.createdAt))
    const itensHoje = hoje.reduce((acc, n) => acc + (n.totalItens ?? 0), 0)
    const seteDias = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentes = lista.filter((n) => new Date(n.createdAt).getTime() >= seteDias)
    const concluidas = recentes.filter((n) => n.status === "conferida" || n.status === "reconhecida").length
    const taxa = recentes.length ? Math.round((concluidas / recentes.length) * 100) : 0
    return { notasHoje: hoje.length, itensHoje, taxa }
  }, [notasList])

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      // Importa apenas um arquivo por vez.
      const fileArray = [files[0]]
      setUploading(true)
      let dup = 0
      const importadas: { notaId: number }[] = []
      for (const file of fileArray) {
        try {
          const text = await file.text()
          const res = await importNfeXml(text, t.origem)
          if (res.ok) {
            if (res.duplicada) {
              dup++
            } else {
              importadas.push({ notaId: res.notaId })
              toast.success(`${file.name}: ${res.totalItens} itens, ${res.comMatch} reconhecido(s)`)
            }
          } else {
            toast.error(`${file.name}: ${res.error}`)
          }
        } catch {
          toast.error(`${file.name}: falha ao ler o arquivo`)
        }
      }
      if (dup) toast.info(`${dup} nota(s) já importada(s) foram ignoradas`)
      setUploading(false)
      mutate()

      // Importou uma única nota nova? Vai direto para a tela de vinculação.
      if (importadas.length === 1) {
        router.push(`${t.vincularBase}/${importadas[0].notaId}/vincular`)
      }
    },
    [mutate, router, t],
  )

  async function handleDelete(id: number) {
    await deleteNota(id)
    toast.success("Nota removida")
    mutate()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Abertura: dropzone + dica/estatísticas */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Dropzone */}
        <Card
          className={`flex min-h-72 flex-col items-center justify-center gap-4 border-2 border-dashed p-8 text-center transition-colors lg:col-span-2 ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : modo === "reconhecimento" ? (
              <PackagePlus className="h-8 w-8" />
            ) : (
              <Upload className="h-8 w-8" />
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-foreground text-balance">
              {uploading ? "Processando NF-e..." : t.dropTitulo}
            </p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{t.dropSub}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2">
            <FileText className="h-4 w-4" />
            Selecionar arquivo XML
          </Button>
          <p className="text-xs text-muted-foreground">Formatos aceitos: .xml · Tamanho máximo: 50MB</p>
        </Card>

        {/* Dica + estatísticas */}
        <div className="flex flex-col gap-4">
          <Card className="flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lightbulb className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Dica</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground text-pretty">{t.dica}</p>
            </div>
          </Card>

          <Card className="flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-extrabold leading-none tabular-nums text-foreground">{stats.notasHoje}</p>
              <p className="mt-1 text-sm font-medium text-foreground">Notas importadas hoje</p>
              <p className="text-xs text-muted-foreground">Total de {stats.itensHoje} itens</p>
            </div>
          </Card>

          <Card className="flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PieChart className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-extrabold leading-none tabular-nums text-foreground">{stats.taxa}%</p>
              <p className="mt-1 text-sm font-medium text-foreground">Taxa de sucesso</p>
              <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Lista de notas importadas */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t.listaTitulo}</h2>
            <p className="text-sm text-muted-foreground">Acompanhe o status das notas fiscais importadas.</p>
          </div>
          <div className="flex items-center gap-2">
            {modo === "importacao" && (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44">
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
            )}
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
                <TableHead className="w-28 text-right">Ações</TableHead>
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
                    {t.vazio}
                  </TableCell>
                </TableRow>
              ) : (
                notasList.map((n: NotaListItem) => {
                  const total = n.totalItens ?? 0
                  const feitos =
                    modo === "reconhecimento" ? total - n.itensPendentes : n.itensConferidos ?? 0
                  const pct = total > 0 ? Math.round((feitos / total) * 100) : 0
                  return (
                    <TableRow key={n.id}>
                      <TableCell>
                        <span className="font-semibold text-foreground">
                          {n.numero ? `Nº ${n.numero}` : `#${n.id}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <span className="max-w-56 truncate font-medium text-foreground">
                            {n.fornecedorNome ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col leading-tight">
                          <span className="text-foreground">{fmtDate(n.dataEmissao)}</span>
                          {fmtTime(n.dataEmissao) && (
                            <span className="text-xs text-muted-foreground">{fmtTime(n.dataEmissao)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">
                        {fmtCurrency(n.valorTotal)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center leading-tight">
                          <span className="tabular-nums text-foreground">
                            {feitos}/{total}
                          </span>
                          <span
                            className={`text-xs ${
                              pct === 100 ? "text-success" : pct > 0 ? "text-primary" : "text-muted-foreground"
                            }`}
                          >
                            {pct}% conferido
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusDot status={n.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {modo === "reconhecimento" ? (
                            <Button asChild size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
                              <Link href={`${t.vincularBase}/${n.id}/vincular`} aria-label="Reconhecer produtos da nota">
                                <PackagePlus className="h-3.5 w-3.5" />
                                {n.itensPendentes > 0 ? `${t.acaoVincular} (${n.itensPendentes})` : "Revisar"}
                              </Link>
                            </Button>
                          ) : n.status === "conferida" || n.status === "divergente" ? (
                            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs">
                              <Link href={`/estoque/conferencia/${n.id}`} aria-label="Ver relatório da nota">
                                <ClipboardList className="h-3.5 w-3.5" />
                                Relatório
                              </Link>
                            </Button>
                          ) : n.status === "pendente" ? (
                            <Button asChild size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
                              <Link href={`${t.vincularBase}/${n.id}/vincular`} aria-label="Vincular produtos da nota">
                                <Link2 className="h-3.5 w-3.5" />
                                {n.itensPendentes > 0 ? `${t.acaoVincular} (${n.itensPendentes})` : "Revisar"}
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
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>

        <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" />
          Os arquivos XML são processados em segundo plano. Você será notificado quando a importação for concluída.
        </p>
      </div>
    </div>
  )
}
