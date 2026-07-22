import Link from "next/link"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/session"
import { ROLE_LABELS, type Role } from "@/lib/permissions"
import { getDashboardMetrics } from "@/app/actions/dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { GaugeCard } from "@/components/dashboard/gauge-card"
import {
  NotasVolumeChart,
  ValorMesChart,
  StatusNotasDonut,
  GarantiasStatusChart,
  TopFornecedoresChart,
  ProdutividadeChart,
  MetodoVinculoChart,
} from "@/components/dashboard/charts"
import { NotaStatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  FileInput,
  Banknote,
  FileClock,
  AlertTriangle,
  ShieldCheck,
  Package,
  Building2,
  PackageSearch,
  ArrowRight,
  Warehouse,
} from "lucide-react"

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

function fmtBRLExato(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })
}

function fmtData(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

const GARANTIA_LABELS: Record<string, string> = {
  pendente: "Triagem",
  em_analise: "Em análise",
  enviado: "Enviado",
  esperando_retorno: "Aguardando retorno",
  concluido: "Concluído",
}

const GARANTIA_TONE: Record<string, string> = {
  pendente: "border-warning/30 bg-warning/15 text-warning",
  em_analise: "border-primary/30 bg-primary/10 text-primary",
  enviado: "border-chart-5/30 bg-muted text-foreground",
  esperando_retorno: "border-warning/30 bg-warning/15 text-warning",
  concluido: "border-success/30 bg-success/15 text-success",
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
}

export default async function DashboardPage() {
  const user = await requireUser()
  // Vendedor tem acesso mínimo: cai direto nas garantias, não vê o dashboard.
  if (user.role === "vendedor") redirect("/garantias")
  const m = await getDashboardMetrics()

  return (
    <div className="flex flex-col gap-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
            Bem-vindo, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Conectado como {ROLE_LABELS[user.role as Role]}. Panorama completo da operação.
          </p>
        </div>
        <Link
          href="/relatorios"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Relatórios detalhados <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* KPIs */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Visão geral</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Notas no mês" value={m.totais.notasMes} icon={FileInput} tone="bg-primary/10 text-primary" />
          <KpiCard
            label="Importado no mês"
            value={fmtBRL(m.totais.valorImportadoMes)}
            icon={Banknote}
            tone="bg-success/15 text-success"
          />
          <KpiCard
            label="Aguardando conferência"
            value={m.totais.notasPendentes}
            icon={FileClock}
            tone="bg-warning/15 text-warning"
          />
          <KpiCard
            label="Itens divergentes"
            value={m.totais.itensDivergentes}
            icon={AlertTriangle}
            tone="bg-destructive/15 text-destructive"
          />
          <KpiCard
            label="Garantias em andamento"
            value={m.totais.garantiasAndamento}
            sublabel={`${m.totais.garantiasConcluidas} concluídas`}
            icon={ShieldCheck}
            tone="bg-primary/10 text-primary"
          />
          <KpiCard
            label="Valor em estoque"
            value={fmtBRL(m.totais.valorEstoque)}
            sublabel={`${m.totais.produtos} produtos ativos`}
            icon={Warehouse}
            tone="bg-muted text-muted-foreground"
          />
          <KpiCard
            label="Unidades na espera"
            value={m.totais.itensEspera}
            icon={PackageSearch}
            tone="bg-muted text-muted-foreground"
          />
          <KpiCard
            label="Fornecedores"
            value={m.totais.fornecedores}
            icon={Building2}
            tone="bg-muted text-muted-foreground"
          />
        </div>
      </section>

      {/* Operação de notas */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Notas fiscais</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <NotasVolumeChart data={m.notasPorDia} />
          </div>
          <div className="lg:col-span-2">
            <StatusNotasDonut data={m.statusNotas} />
          </div>
        </div>
      </section>

      {/* Financeiro */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Financeiro</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <ValorMesChart data={m.valorPorMes} />
          <TopFornecedoresChart data={m.topFornecedores} />
        </div>
      </section>

      {/* Conferência e inteligência */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Conferência e inteligência</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <GaugeCard
            title="Taxa de conferência"
            description="Notas já conferidas"
            value={m.taxaConferencia}
            footer="Percentual do total de notas que já passaram pela conferência."
          />
          <GaugeCard
            title="Vínculo automático"
            description="Itens vinculados sozinhos (30d)"
            value={m.taxaVinculacao}
            footer="Quanto mais o sistema aprende, maior essa taxa."
          />
          <div className="md:col-span-2">
            <MetodoVinculoChart data={m.itensPorMatch} />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ProdutividadeChart data={m.produtividade} />
          <GarantiasStatusChart data={m.garantiasPorStatus} />
        </div>
      </section>

      {/* Tabelas */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border">
            <div>
              <CardTitle className="text-base">Últimas notas</CardTitle>
              <CardDescription>Valores importados recentemente</CardDescription>
            </div>
            <Link
              href="/estoque/conferencia"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver tudo <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {m.ultimasNotas.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma nota importada. Comece pela tela de importação de NF-e.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Nota / Fornecedor</th>
                      <th className="px-2 py-2.5 text-center font-medium">Itens</th>
                      <th className="px-2 py-2.5 text-right font-medium">Valor</th>
                      <th className="px-4 py-2.5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.ultimasNotas.map((n) => (
                      <tr key={n.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">Nº {n.numero ?? "—"}</span>
                          <span className="block max-w-[190px] truncate text-xs text-muted-foreground">
                            {n.fornecedorNome ?? "Sem fornecedor"} · {fmtData(n.createdAt)}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center tabular-nums text-muted-foreground">
                          {n.itensConferidos ?? 0}/{n.totalItens ?? 0}
                        </td>
                        <td className="px-2 py-3 text-right font-medium tabular-nums text-foreground">
                          {fmtBRLExato(Number(n.valorTotal ?? 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <NotaStatusBadge status={n.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40">
                      <td className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground" colSpan={2}>
                        Total exibido
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-foreground" colSpan={2}>
                        {fmtBRLExato(m.ultimasNotas.reduce((acc, n) => acc + Number(n.valorTotal ?? 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border">
            <div>
              <CardTitle className="text-base">Últimas garantias</CardTitle>
              <CardDescription>Solicitações abertas recentemente</CardDescription>
            </div>
            <Link
              href="/estoque/garantia"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver tudo <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {m.ultimasGarantias.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma garantia aberta ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Protocolo</th>
                      <th className="px-4 py-2.5 font-medium">Cliente / Produto</th>
                      <th className="px-4 py-2.5 text-right font-medium">Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.ultimasGarantias.map((g) => (
                      <tr key={g.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{g.protocolo}</span>
                          <span className="block text-xs text-muted-foreground">{fmtData(g.createdAt)}</span>
                        </td>
                        <td className="max-w-[190px] px-4 py-3">
                          <span className="block truncate text-foreground">{g.clienteNome}</span>
                          <span className="block truncate text-xs text-muted-foreground">{g.produtoDescricao}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`border ${GARANTIA_TONE[g.status] ?? GARANTIA_TONE.pendente} hover:bg-transparent`}>
                            {GARANTIA_LABELS[g.status] ?? g.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
