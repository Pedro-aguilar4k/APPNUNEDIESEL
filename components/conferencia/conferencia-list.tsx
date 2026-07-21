"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { ScanLine, ArrowRight, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NotaStatusBadge } from "@/components/status-badge"
import { SearchBar } from "@/components/search-bar"
import { listNotas, type NotaListItem } from "@/app/actions/notas"

function fmtDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-BR")
}

export function ConferenciaList() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("todos")
  const { data, isLoading } = useSWR(["conf-notas", search, status], () => listNotas({ search, status }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar nota ou fornecedor..." />
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Carregando...</p>
      ) : !data || data.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          Nenhuma nota disponível para conferência.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((n: NotaListItem) => {
            const total = n.totalItens ?? 0
            const done = n.itensConferidos ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Card key={n.id} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {n.numero ? `Nota Nº ${n.numero}` : `Nota #${n.id}`}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{n.fornecedorNome ?? "Sem fornecedor"}</p>
                    {n.importadoPor && (
                      <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        {n.importadoPor}
                      </p>
                    )}
                  </div>
                  <NotaStatusBadge status={n.status} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {done}/{total} itens
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Emissão {fmtDate(n.dataEmissao)}</span>
                  <Button asChild size="sm">
                    <Link href={`/estoque/conferencia/${n.id}`}>
                      <ScanLine className="mr-1.5 h-4 w-4" />
                      Conferir
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
