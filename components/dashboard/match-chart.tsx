"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const LABELS: Record<string, string> = {
  ean: "EAN",
  equivalencia: "Equivalência",
  vinculo_aprendido: "Aprendizado",
  fabricante: "Cód. fabricante",
  similaridade: "Similaridade",
  manual: "Manual",
  none: "Sem vínculo",
  nenhum: "Sem vínculo",
}

const chartConfig: ChartConfig = {
  total: { label: "Itens", color: "hsl(var(--chart-1))" },
}

export function MatchChart({ data }: { data: { metodo: string; total: number }[] }) {
  const rows = data
    .map((d) => ({ metodo: LABELS[d.metodo] ?? d.metodo, total: d.total }))
    .sort((a, b) => b.total - a.total)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Itens por método de vínculo</CardTitle>
        <CardDescription>Distribuição dos itens importados nos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum item importado ainda.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="metodo"
                type="category"
                tickLine={false}
                axisLine={false}
                width={110}
                tick={{ fontSize: 12 }}
              />
              <XAxis dataKey="total" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
