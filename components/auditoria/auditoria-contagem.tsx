"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { MapPin, ScanLine, Plus, Loader2, Trash2, Package, Pencil, Check, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { registrarContagem, atualizarContagem, type Contagem } from "@/app/actions/auditoria"

// Beep curto reaproveitando o padrão da Conferência.
let sharedAudioCtx: AudioContext | null = null
function beep(kind: "ok" | "error") {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const ctx = sharedAudioCtx
    if (ctx.state === "suspended") void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = kind === "ok" ? 1040 : 220
    osc.type = kind === "ok" ? "sine" : "square"
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14)
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    /* ignora ambientes sem áudio */
  }
}

export function AuditoriaContagem({
  auditoriaId,
  contagens,
  onChange,
}: {
  auditoriaId: number
  contagens: Contagem[]
  onChange: () => Promise<void>
}) {
  const [andar, setAndar] = useState("")
  const [rua, setRua] = useState("")
  const [box, setBox] = useState("")
  const [codigo, setCodigo] = useState("")
  const [quantidade, setQuantidade] = useState("1")
  const [observacao, setObservacao] = useState("")
  const [pending, startTransition] = useTransition()
  const [editId, setEditId] = useState<number | null>(null)
  const [editQtd, setEditQtd] = useState("")
  const codigoRef = useRef<HTMLInputElement>(null)

  const localizacaoPronta = andar.trim() && rua.trim() && box.trim()
  const localizacaoFull = [andar, rua, box].map((v) => v.trim().toUpperCase()).filter(Boolean).join(" ")

  // Códigos encontrados em mais de uma localização (aviso, não erro).
  const codigosMultiplos = useMemo(() => {
    const locaisPorCodigo = new Map<string, Set<string>>()
    for (const c of contagens) {
      const set = locaisPorCodigo.get(c.codigo) ?? new Set<string>()
      set.add(c.localizacaoFull)
      locaisPorCodigo.set(c.codigo, set)
    }
    return new Set([...locaisPorCodigo.entries()].filter(([, set]) => set.size > 1).map(([cod]) => cod))
  }, [contagens])

  function handleRegistrar() {
    const cod = codigo.trim()
    if (!localizacaoPronta) { toast.error("Selecione a localização (Andar, Rua e Box) antes de bipar."); beep("error"); return }
    if (!cod) { beep("error"); return }
    const qtd = Number(quantidade)
    if (!Number.isFinite(qtd) || qtd <= 0) { toast.error("Quantidade inválida."); beep("error"); return }

    startTransition(async () => {
      const result = await registrarContagem({
        auditoriaId,
        codigo: cod,
        andar,
        rua,
        box,
        quantidade: qtd,
        observacao: observacao.trim() || undefined,
      })
      if (!result.ok) { toast.error(result.error); beep("error"); return }
      beep("ok")
      setCodigo("")
      setQuantidade("1")
      setObservacao("")
      codigoRef.current?.focus()
      await onChange()
    })
  }

  function salvarEdicao(id: number) {
    const qtd = Number(editQtd)
    if (!Number.isFinite(qtd) || qtd < 0) { toast.error("Quantidade inválida."); return }
    startTransition(async () => {
      const result = await atualizarContagem(id, qtd)
      if (!result.ok) { toast.error(result.error); return }
      setEditId(null)
      await onChange()
    })
  }

  function remover(id: number) {
    startTransition(async () => {
      const result = await atualizarContagem(id, 0)
      if (!result.ok) { toast.error(result.error); return }
      await onChange()
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      {/* Painel de leitura */}
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="size-4 text-primary" />Localização</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="andar" className="text-xs">Andar</Label>
                <Input id="andar" value={andar} onChange={(e) => setAndar(e.target.value)} placeholder="G1" className="h-11 uppercase" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rua" className="text-xs">Rua</Label>
                <Input id="rua" value={rua} onChange={(e) => setRua(e.target.value)} placeholder="R18" className="h-11 uppercase" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="box" className="text-xs">Box</Label>
                <Input id="box" value={box} onChange={(e) => setBox(e.target.value)} placeholder="BX31A" className="h-11 uppercase" />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Localização atual:</span>
              {localizacaoPronta
                ? <span className="font-mono font-medium">{localizacaoFull}</span>
                : <span className="text-muted-foreground">defina Andar, Rua e Box</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base"><ScanLine className="size-4 text-primary" />Leitura do produto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="codigo" className="text-xs">Código do produto</Label>
              <Input
                id="codigo"
                ref={codigoRef}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Bipe ou digite o código"
                disabled={!localizacaoPronta}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleRegistrar() } }}
                className="h-12 font-mono text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantidade" className="text-xs">Quantidade encontrada</Label>
              <Input
                id="quantidade"
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                disabled={!localizacaoPronta}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleRegistrar() } }}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacao" className="text-xs">Observação (opcional)</Label>
              <Input id="observacao" value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={!localizacaoPronta} placeholder="Ex.: caixa danificada" className="h-11" />
            </div>
            <Button onClick={handleRegistrar} disabled={pending || !localizacaoPronta} className="h-11">
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}Registrar leitura
            </Button>
            <p className="text-center text-xs text-muted-foreground">Salvo automaticamente. Mesmo código + localização soma na quantidade.</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de leituras */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4 text-primary" />Leituras registradas
            <Badge variant="secondary" className="ml-auto">{contagens.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contagens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <ScanLine className="size-8" />
              Nenhuma leitura ainda. Defina a localização e comece a bipar.
            </div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contagens.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">
                        <div className="flex items-center gap-2">
                          {c.codigo}
                          {codigosMultiplos.has(c.codigo) && (
                            <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-500">
                              <AlertTriangle className="size-3" />Múltiplas
                            </Badge>
                          )}
                        </div>
                        {c.observacao ? <p className="text-xs font-sans text-muted-foreground">{c.observacao}</p> : null}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{c.localizacaoFull}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {editId === c.id ? (
                          <Input
                            type="number"
                            min={0}
                            value={editQtd}
                            onChange={(e) => setEditQtd(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") salvarEdicao(c.id) }}
                            autoFocus
                            className="ml-auto h-8 w-20 text-right"
                          />
                        ) : (
                          <span className="font-medium">{c.quantidade}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editId === c.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => salvarEdicao(c.id)} aria-label="Salvar"><Check className="size-4" /></Button>
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditId(null)} aria-label="Cancelar"><X className="size-4" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => { setEditId(c.id); setEditQtd(String(c.quantidade)) }} aria-label="Editar"><Pencil className="size-4" /></Button>
                            <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => remover(c.id)} aria-label="Remover"><Trash2 className="size-4" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
