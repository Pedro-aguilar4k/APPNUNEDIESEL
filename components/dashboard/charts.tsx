"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

// --- Formatadores compartilhados -------------------------------------------

function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

function fmtCompact(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
  return fmtCurrency(v)
}

function fmtMes(mes: string) {
  const [ano, m] = mes.split("-")
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  return `${nomes[Number(m) - 1] ?? m}/${ano.slice(2)}`
}

function fmtDia(dia: string) {
  const [, m, d] = dia.split("-")
  return `${d}/${m}`
}

function Empty({ msg }: { msg: string }) {
  return <p className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">{msg}</p>
}

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

// --- Volume de notas por dia (área) ----------------------------------------

const volumeConfig: ChartConfig = {
  total: { label: "Importadas", color: "hsl(var(--chart-1))" },
  conferidas: { label: "Conferidas", color: "hsl(var(--chart-3))" },
}

export function NotasVolumeChart({ data }: { data: { dia: string; total: number; conferidas: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: fmtDia(d.dia) }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Volume de notas</CardTitle>
        <CardDescription>Importadas x conferidas nos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty msg="Nenhuma nota importada nos últimos 30 dias." />
        ) : (
          <ChartContainer config={volumeConfig} className="h-[240px] w-full">
            <AreaChart accessibilityLayer data={rows} margin={{ left: 4, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="fillConf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-conferidas)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-conferidas)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="total"
                type="monotone"
                fill="url(#fillTotal)"
                stroke="var(--color-total)"
                strokeWidth={2}
              />
              <Area
                dataKey="conferidas"
                type="monotone"
                fill="url(#fillConf)"
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

// --- Valor importado por mês (barras) --------------------------------------

const valorConfig: ChartConfig = {
  valor: { label: "Valor", color: "hsl(var(--chart-2))" },
}

export function ValorMesChart({ data }: { data: { mes: string; valor: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: fmtMes(d.mes) }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Valor importado por mês</CardTitle>
        <CardDescription>Soma do valor das notas nos últimos 6 meses</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty msg="Nenhuma nota com valor registrado." />
        ) : (
          <ChartContainer config={valorConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => fmtCompact(Number(v))} />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => fmtCurrency(Number(v))} />}
              />
              <Bar dataKey="valor" fill="var(--color-valor)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// --- Status das notas (donut) ----------------------------------------------

const STATUS_NOTA_LABELS: Record<string, string> = {
  pendente: "Aguardando",
  em_conferencia: "Em conferência",
  conferida: "Conferida",
  divergente: "Divergente",
}
const STATUS_NOTA_COLORS: Record<string, string> = {
  pendente: "hsl(var(--chart-4))",
  em_conferencia: "hsl(var(--chart-1))",
  conferida: "hsl(var(--chart-3))",
  divergente: "hsl(var(--chart-2))",
}

export function StatusNotasDonut({ data }: { data: { status: string; total: number }[] }) {
  const rows = data.filter((d) => d.total > 0).map((d) => ({
    key: d.status,
    label: STATUS_NOTA_LABELS[d.status] ?? d.status,
    total: d.total,
    fill: STATUS_NOTA_COLORS[d.status] ?? "hsl(var(--chart-5))",
  }))
  const totalGeral = rows.reduce((acc, r) => acc + r.total, 0)
  const config: ChartConfig = Object.fromEntries(rows.map((r) => [r.key, { label: r.label, color: r.fill }]))

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Status das notas</CardTitle>
        <CardDescription>Distribuição de todas as notas</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {totalGeral === 0 ? (
          <Empty msg="Nenhuma nota cadastrada." />
        ) : (
          <ChartContainer config={config} className="mx-auto aspect-square max-h-[240px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <Pie data={rows} dataKey="total" nameKey="key" innerRadius={58} strokeWidth={4}>
                {rows.map((r) => (
                  <Cell key={r.key} fill={r.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                            {totalGeral}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                            notas
                          </tspan>
                        </text>
                      )
                    }
                    return null
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

// --- Garantias por status (barras horizontais) -----------------------------

const GARANTIA_LABELS: Record<string, string> = {
  pendente: "Triagem",
  em_analise: "Em análise",
  enviado: "Enviado",
  esperando_retorno: "Aguardando retorno",
  concluido: "Concluído",
}
const GARANTIA_ORDER = ["pendente", "em_analise", "enviado", "esperando_retorno", "concluido"]

const garantiaConfig: ChartConfig = {
  total: { label: "Garantias", color: "hsl(var(--chart-1))" },
}

export function GarantiasStatusChart({ data }: { data: { status: string; total: number }[] }) {
  const map = new Map(data.map((d) => [d.status, d.total]))
  const rows = GARANTIA_ORDER.filter((s) => (map.get(s) ?? 0) > 0).map((s) => ({
    label: GARANTIA_LABELS[s],
    total: map.get(s) ?? 0,
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Garantias por etapa</CardTitle>
        <CardDescription>Tickets em cada estágio do fluxo</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty msg="Nenhuma garantia aberta." />
        ) : (
          <ChartContainer config={garantiaConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 24 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={130}
                tick={{ fontSize: 12 }}
              />
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

// --- Top fornecedores por valor (barras horizontais) -----------------------

const fornConfig: ChartConfig = {
  valor: { label: "Valor", color: "hsl(var(--chart-2))" },
}

export function TopFornecedoresChart({ data }: { data: { nome: string; valor: number; notas: number }[] }) {
  const rows = data
    .filter((d) => d.valor > 0)
    .map((d) => ({ nome: d.nome.length > 22 ? d.nome.slice(0, 22) + "…" : d.nome, valor: d.valor, notas: d.notas }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top fornecedores</CardTitle>
        <CardDescription>Maior valor importado nos últimos 90 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty msg="Nenhuma nota com fornecedor nos últimos 90 dias." />
        ) : (
          <ChartContainer config={fornConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="nome"
                type="category"
                tickLine={false}
                axisLine={false}
                width={150}
                tick={{ fontSize: 11 }}
              />
              <XAxis dataKey="valor" type="number" hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent formatter={(v) => fmtCurrency(Number(v))} hideLabel />}
              />
              <Bar dataKey="valor" fill="var(--color-valor)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// --- Produtividade por estoquista (barras horizontais) ---------------------

const prodConfig: ChartConfig = {
  itens: { label: "Itens conferidos", color: "hsl(var(--chart-5))" },
}

export function ProdutividadeChart({ data }: { data: { estoquista: string; notas: number; itens: number }[] }) {
  const rows = data.map((d) => ({
    nome: d.estoquista.length > 20 ? d.estoquista.slice(0, 20) + "…" : d.estoquista,
    itens: d.itens,
    notas: d.notas,
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Produtividade da conferência</CardTitle>
        <CardDescription>Itens conferidos por estoquista (90 dias)</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty msg="Nenhuma conferência finalizada ainda." />
        ) : (
          <ChartContainer config={prodConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="nome"
                type="category"
                tickLine={false}
                axisLine={false}
                width={130}
                tick={{ fontSize: 11 }}
              />
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

// --- Método de vínculo (barras horizontais) --------------------------------

const MATCH_LABELS: Record<string, string> = {
  ean: "EAN",
  equivalencia: "Equivalência",
  vinculo_aprendido: "Aprendizado",
  fabricante: "Cód. fabricante",
  similaridade: "Similaridade",
  manual: "Manual",
  none: "Sem vínculo",
  nenhum: "Sem vínculo",
}

const matchConfig: ChartConfig = {
  total: { label: "Itens", color: "hsl(var(--chart-1))" },
}

export function MetodoVinculoChart({ data }: { data: { metodo: string; total: number }[] }) {
  const rows = data
    .map((d) => ({ metodo: MATCH_LABELS[d.metodo] ?? d.metodo, total: d.total }))
    .sort((a, b) => b.total - a.total)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Itens por método de vínculo</CardTitle>
        <CardDescription>Como os itens foram vinculados (30 dias)</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty msg="Nenhum item importado ainda." />
        ) : (
          <ChartContainer config={matchConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="metodo"
                type="category"
                tickLine={false}
                axisLine={false}
                width={120}
                tick={{ fontSize: 12 }}
              />
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
