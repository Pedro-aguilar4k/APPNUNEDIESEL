"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

function fmtDia(dia: string) {
  const [, mes, data] = dia.split("-")
  return `${data}/${mes}`
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return <p className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">{children}</p>
}

const volumeConfig = {
  total: { label: "Importadas", color: "hsl(var(--chart-1))" },
  conferidas: { label: "Conferidas", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig

export function NotasVolumeChart({ data }: { data: { dia: string; total: number; conferidas: number }[] }) {
  const rows = data.map((item) => ({ ...item, label: fmtDia(item.dia) }))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Ritmo de recebimento</CardTitle>
        <CardDescription>Notas importadas e concluídas nos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart>Nenhuma nota importada nos últimos 30 dias.</EmptyChart>
        ) : (
          <ChartContainer config={volumeConfig} className="h-[260px] w-full">
            <AreaChart accessibilityLayer data={rows} margin={{ left: 4, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="fillConferidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-conferidas)" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="var(--color-conferidas)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area dataKey="total" type="monotone" fill="url(#fillTotal)" stroke="var(--color-total)" strokeWidth={2} />
              <Area
                dataKey="conferidas"
                type="monotone"
                fill="url(#fillConferidas)"
                stroke="var(--color-conferidas)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Aguardando",
  em_conferencia: "Em conferência",
  conferida: "Conferida",
  divergente: "Divergente",
}

const STATUS_COLORS: Record<string, string> = {
  pendente: "hsl(var(--chart-4))",
  em_conferencia: "hsl(var(--chart-1))",
  conferida: "hsl(var(--chart-3))",
  divergente: "hsl(var(--chart-2))",
}

export function StatusNotasDonut({ data }: { data: { status: string; total: number }[] }) {
  const rows = data
    .filter((item) => item.total > 0)
    .map((item) => ({
      key: item.status,
      label: STATUS_LABELS[item.status] ?? item.status,
      total: item.total,
      fill: STATUS_COLORS[item.status] ?? "hsl(var(--chart-5))",
    }))
  const total = rows.reduce((sum, item) => sum + item.total, 0)
  const config = Object.fromEntries(rows.map((item) => [item.key, { label: item.label, color: item.fill }])) satisfies ChartConfig

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-base">Fluxo das notas</CardTitle>
        <CardDescription>Distribuição atual por etapa operacional</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {total === 0 ? (
          <EmptyChart>Nenhuma nota cadastrada.</EmptyChart>
        ) : (
          <ChartContainer config={config} className="mx-auto aspect-square max-h-[260px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <Pie data={rows} dataKey="total" nameKey="key" innerRadius={62} strokeWidth={4}>
                {rows.map((item) => <Cell key={item.key} fill={item.fill} />)}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">{total}</tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">notas</tspan>
                      </text>
                    )
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap gap-x-3" />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const garantiaLabels: Record<string, string> = {
  pendente: "Triagem",
  em_analise: "Em análise",
  enviado: "Enviado",
  esperando_retorno: "Aguardando retorno",
  concluido: "Concluído",
}
const garantiaOrder = ["pendente", "em_analise", "enviado", "esperando_retorno", "concluido"]
const garantiaConfig = { total: { label: "Garantias", color: "hsl(var(--chart-1))" } } satisfies ChartConfig

export function GarantiasStatusChart({ data }: { data: { status: string; total: number }[] }) {
  const counts = new Map(data.map((item) => [item.status, item.total]))
  const rows = garantiaOrder.filter((status) => (counts.get(status) ?? 0) > 0).map((status) => ({
    label: garantiaLabels[status],
    total: counts.get(status) ?? 0,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Garantias por etapa</CardTitle>
        <CardDescription>Solicitações em cada estágio do atendimento</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart>Nenhuma garantia aberta.</EmptyChart>
        ) : (
          <ChartContainer config={garantiaConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 24 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={130} tick={{ fontSize: 12 }} />
              <XAxis dataKey="total" type="number" hide allowDecimals={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const fornecedorConfig = { notas: { label: "Notas", color: "hsl(var(--chart-2))" } } satisfies ChartConfig

export function TopFornecedoresChart({ data }: { data: { nome: string; notas: number }[] }) {
  const rows = data.map((item) => ({
    nome: item.nome.length > 22 ? `${item.nome.slice(0, 22)}…` : item.nome,
    notas: item.notas,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fornecedores mais ativos</CardTitle>
        <CardDescription>Quantidade de notas recebidas nos últimos 90 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart>Nenhum fornecedor com movimentação recente.</EmptyChart>
        ) : (
          <ChartContainer config={fornecedorConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="nome" type="category" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 11 }} />
              <XAxis dataKey="notas" type="number" hide allowDecimals={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="notas" fill="var(--color-notas)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const produtividadeConfig = { itens: { label: "Itens conferidos", color: "hsl(var(--chart-5))" } } satisfies ChartConfig

export function ProdutividadeChart({ data }: { data: { estoquista: string; notas: number; itens: number }[] }) {
  const rows = data.map((item) => ({
    nome: item.estoquista.length > 20 ? `${item.estoquista.slice(0, 20)}…` : item.estoquista,
    itens: item.itens,
    notas: item.notas,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Produtividade da conferência</CardTitle>
        <CardDescription>Itens conferidos por estoquista nos últimos 90 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart>Nenhuma conferência finalizada ainda.</EmptyChart>
        ) : (
          <ChartContainer config={produtividadeConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="nome" type="category" tickLine={false} axisLine={false} width={130} tick={{ fontSize: 11 }} />
              <XAxis dataKey="itens" type="number" hide allowDecimals={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="itens" fill="var(--color-itens)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const metodoLabels: Record<string, string> = {
  ean: "EAN",
  equivalencia: "Equivalência",
  vinculo_aprendido: "Aprendizado",
  fabricante: "Cód. fabricante",
  similaridade: "Similaridade",
  manual: "Manual",
  none: "Sem vínculo",
  nenhum: "Sem vínculo",
}
const metodoConfig = { total: { label: "Itens", color: "hsl(var(--chart-1))" } } satisfies ChartConfig

export function MetodoVinculoChart({ data }: { data: { metodo: string; total: number }[] }) {
  const rows = data
    .map((item) => ({ metodo: metodoLabels[item.metodo] ?? item.metodo, total: item.total }))
    .sort((a, b) => b.total - a.total)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Como os itens foram vinculados</CardTitle>
        <CardDescription>Métodos usados nas importações dos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart>Nenhum item importado ainda.</EmptyChart>
        ) : (
          <ChartContainer config={metodoConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="metodo" type="category" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 12 }} />
              <XAxis dataKey="total" type="number" hide allowDecimals={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
