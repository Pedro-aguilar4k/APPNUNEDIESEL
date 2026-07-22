"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Pencil, Trash2 } from "lucide-react"
import type { ModuloControle } from "@/app/actions/controle"

const SERIES_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

function toNumber(v: string) {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

export function ModuloCard({
  modulo,
  canWrite,
  onEdit,
  onDelete,
}: {
  modulo: ModuloControle
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const colunas = modulo.colunas ?? []
  const linhas = modulo.linhas ?? []
  const series = colunas.slice(1)

  const { data, config, totais } = useMemo(() => {
    const config: ChartConfig = {}
    series.forEach((nome, i) => {
      config[`s${i}`] = { label: nome || `Série ${i + 1}`, color: SERIES_COLORS[i % SERIES_COLORS.length] }
    })

    const data = linhas.map((linha) => {
      const row: Record<string, string | number> = { rotulo: linha[0] || "—" }
      series.forEach((_, i) => {
        row[`s${i}`] = toNumber(linha[i + 1] ?? "0")
      })
      return row
    })

    const totais = series.map((_, i) => data.reduce((acc, r) => acc + Number(r[`s${i}`] ?? 0), 0))

    return { data, config, totais }
  }, [linhas, series])

  const hasData = data.length > 0 && series.length > 0

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-border">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{modulo.titulo}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {linhas.length} linha{linhas.length === 1 ? "" : "s"} · {series.length} coluna
            {series.length === 1 ? "" : "s"} de dados
          </p>
        </div>
        {canWrite && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Editar módulo">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label="Excluir módulo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        {hasData ? (
          <>
            <ChartContainer config={config} className="h-[220px] w-full">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="rotulo"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {series.map((_, i) => (
                  <Bar key={i} dataKey={`s${i}`} fill={`var(--color-s${i})`} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ChartContainer>

            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3">
              {series.map((nome, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">{nome || `Série ${i + 1}`}:</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {totais[i].toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
            Nenhum dado neste módulo. Edite para preencher a grade.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
