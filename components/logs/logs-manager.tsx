"use client"

import { useMemo, useState } from "react"
import { Search, ScrollText, Filter } from "lucide-react"
import { LOG_AREA_LABELS, LOG_AREAS, type LogArea, type LogRow } from "@/lib/logs-shared"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Cor do "chip" de cada área, dentro da paleta de tokens do tema.
const AREA_CLASSES: Record<LogArea, string> = {
  importacao: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  conferencia: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  espera: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  garantias: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  produtos: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  fornecedores: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  equivalencias: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  usuarios: "bg-chart-4/15 text-chart-4 border-chart-4/30",
}

function formatarData(d: Date) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function iniciais(nome: string) {
  return (nome?.trim()?.[0] ?? "?").toUpperCase()
}

export function LogsManager({ logs }: { logs: LogRow[] }) {
  const [busca, setBusca] = useState("")
  const [areaFiltro, setAreaFiltro] = useState<"todos" | LogArea>("todos")

  const termo = busca.trim().toLowerCase()

  const filtrados = useMemo(() => {
    return logs.filter((l) => {
      if (areaFiltro !== "todos" && l.area !== areaFiltro) return false
      if (termo) {
        const alvo = `${l.actorNome ?? ""} ${l.detalhe}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [logs, areaFiltro, termo])

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por responsável ou descrição..."
            className="pl-10"
            aria-label="Buscar nos logs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Área:
          </span>
          <FiltroChip ativo={areaFiltro === "todos"} onClick={() => setAreaFiltro("todos")}>
            Todas
          </FiltroChip>
          {LOG_AREAS.map((a) => (
            <FiltroChip key={a} ativo={areaFiltro === a} onClick={() => setAreaFiltro(a)}>
              {LOG_AREA_LABELS[a]}
            </FiltroChip>
          ))}
        </div>
      </div>

      {/* Contagem */}
      <p className="text-sm text-muted-foreground">
        {filtrados.length} {filtrados.length === 1 ? "registro" : "registros"}
        {logs.length !== filtrados.length ? ` de ${logs.length}` : ""}
      </p>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <ScrollText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Nenhum registro encontrado</p>
            <p className="text-sm text-muted-foreground">
              {logs.length === 0
                ? "Assim que houver movimentações na plataforma, elas aparecerão aqui."
                : "Ajuste os filtros para ver outros registros."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtrados.map((log) => (
            <li
              key={log.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                {iniciais(log.actorNome ?? "?")}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{log.actorNome ?? "Sistema"}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      AREA_CLASSES[log.area as LogArea] ?? "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {LOG_AREA_LABELS[log.area as LogArea] ?? log.area}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground text-pretty">{log.detalhe}</p>
              </div>
              <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground" dateTime={new Date(log.createdAt).toISOString()}>
                {formatarData(log.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
