"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, Table2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { importarEstoqueOficial, type LinhaOficial } from "@/app/actions/auditoria"

type RawRow = Record<string, unknown>

// Tenta adivinhar a coluna certa pelo nome do cabeçalho.
function adivinhar(headers: string[], candidatos: string[]): string {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  for (const cand of candidatos) {
    const achado = headers.find((h) => norm(h).includes(cand))
    if (achado) return achado
  }
  return ""
}

const NAO_MAPEAR = "__none__"

export function AuditoriaImportacao({
  auditoriaId,
  oficial,
  onChange,
}: {
  auditoriaId: number
  oficial: LinhaOficial[]
  onChange: () => Promise<void>
}) {
  const [rows, setRows] = useState<RawRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [colCodigo, setColCodigo] = useState("")
  const [colDescricao, setColDescricao] = useState("")
  const [colQtd, setColQtd] = useState("")
  const [colLocal, setColLocal] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function lerArquivo(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" })
      if (json.length === 0) { toast.error("A planilha está vazia."); return }
      const hdrs = Object.keys(json[0])
      setRows(json)
      setHeaders(hdrs)
      setFileName(file.name)
      setColCodigo(adivinhar(hdrs, ["codigo", "cod", "sku", "referencia", "ref"]))
      setColDescricao(adivinhar(hdrs, ["descricao", "produto", "nome", "desc"]))
      setColQtd(adivinhar(hdrs, ["quantidade", "qtd", "estoque", "saldo", "qtde"]))
      setColLocal(adivinhar(hdrs, ["localizacao", "local", "endereco", "posicao"]))
      toast.success(`${json.length} linha(s) lida(s). Confira o mapeamento das colunas.`)
    } catch {
      toast.error("Não foi possível ler o arquivo. Use um .xlsx ou .csv válido.")
    }
  }

  function onFile(files: FileList | null) {
    const file = files?.[0]
    if (file) void lerArquivo(file)
  }

  const preview: LinhaOficial[] = useMemo(() => {
    if (!colCodigo) return []
    return rows.map((r) => ({
      codigo: String(r[colCodigo] ?? "").trim(),
      descricao: colDescricao ? String(r[colDescricao] ?? "").trim() : null,
      quantidadeSistema: Number(String(r[colQtd] ?? "0").replace(",", ".")) || 0,
      localizacaoPrincipal: colLocal ? String(r[colLocal] ?? "").trim() : null,
    })).filter((l) => l.codigo)
  }, [rows, colCodigo, colDescricao, colQtd, colLocal])

  function confirmarImportacao() {
    if (!colCodigo) { toast.error("Selecione a coluna de código."); return }
    if (preview.length === 0) { toast.error("Nenhuma linha válida para importar."); return }
    startTransition(async () => {
      const result = await importarEstoqueOficial(auditoriaId, preview)
      if (!result.ok) { toast.error(result.error); return }
      toast.success(`Estoque oficial importado: ${result.data.total} itens.`)
      setRows([])
      setHeaders([])
      setFileName("")
      await onChange()
    })
  }

  const jaImportado = oficial.length > 0

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            O estoque oficial é usado <strong className="text-foreground">apenas como referência</strong> para comparar com a contagem física.
            Nada é enviado de volta ao sistema da empresa. Reimportar substitui a referência anterior.
          </p>
        </CardContent>
      </Card>

      {jaImportado && rows.length === 0 && (
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-success" />Estoque oficial importado
              <Badge variant="secondary" className="ml-auto">{oficial.length} itens</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              Já existe um estoque oficial importado para esta auditoria. Você pode importar um novo arquivo abaixo para substituí-lo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dropzone */}
      {rows.length === 0 && (
        <Card
          className={`border-dashed transition-colors ${dragOver ? "border-primary bg-primary/5" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files) }}
        >
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Upload className="size-7" /></span>
            <div>
              <p className="font-medium">Arraste o arquivo do estoque oficial aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">Formatos aceitos: .xlsx ou .csv exportados do sistema da empresa</p>
            </div>
            <Button variant="outline" onClick={() => inputRef.current?.click()}><FileSpreadsheet />Selecionar arquivo</Button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files)} />
          </CardContent>
        </Card>
      )}

      {/* Mapeamento + preview */}
      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base">
                <Table2 className="size-4 text-primary" />Mapeie as colunas
                <span className="ml-auto text-sm font-normal text-muted-foreground">{fileName}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Código <span className="text-destructive">*</span></Label>
                <Select value={colCodigo} onValueChange={setColCodigo}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Descrição</Label>
                <Select value={colDescricao || NAO_MAPEAR} onValueChange={(v) => setColDescricao(v === NAO_MAPEAR ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent><SelectItem value={NAO_MAPEAR}>Nenhuma</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Quantidade sistema</Label>
                <Select value={colQtd || NAO_MAPEAR} onValueChange={(v) => setColQtd(v === NAO_MAPEAR ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent><SelectItem value={NAO_MAPEAR}>Nenhuma</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Localização principal</Label>
                <Select value={colLocal || NAO_MAPEAR} onValueChange={(v) => setColLocal(v === NAO_MAPEAR ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent><SelectItem value={NAO_MAPEAR}>Nenhuma</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base">
                Prévia <Badge variant="secondary">{preview.length} itens válidos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd sistema</TableHead>
                      <TableHead>Localização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 100).map((l, i) => (
                      <TableRow key={`${l.codigo}-${i}`}>
                        <TableCell className="font-mono font-medium">{l.codigo}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.descricao ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.quantidadeSistema}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{l.localizacaoPrincipal ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 100 && <p className="border-t px-4 py-2 text-center text-xs text-muted-foreground">Mostrando 100 de {preview.length} linhas.</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setRows([]); setHeaders([]); setFileName("") }}><RefreshCw />Escolher outro arquivo</Button>
            <Button onClick={confirmarImportacao} disabled={pending || !colCodigo}>
              {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Importar {preview.length} itens
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
