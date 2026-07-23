import Link from "next/link"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/session"
import { ROLE_LABELS, type Role } from "@/lib/permissions"
import { getDashboardMetrics } from "@/app/actions/dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { GaugeCard } from "@/components/dashboard/gauge-card"
import {
  NotasVolumeChart,
  StatusNotasDonut,
  GarantiasStatusChart,
  TopFornecedoresChart,
  ProdutividadeChart,
  MetodoVinculoChart,
} from "@/components/dashboard/charts"
import { NotaStatusBadge } from "@/components/status-badge"
import {
  FileInput,
  ScanBarcode,
  FileClock,
  AlertTriangle,
  ShieldCheck,
  PackageSearch,
  ArrowRight,
  Boxes,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

function fmtData(value: Date | string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
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
  enviado: "border-border bg-muted text-foreground",
  esperando_retorno: "border-warning/30 bg-warning/15 text-warning",
  concluido: "border-success/30 bg-success/15 text-success",
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
}

// Atalho rápido de ação
function QuickAction({ href, icon: Icon, title, description }: { href: string; icon: LucideIcon; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
    </Link>
  )
}

// Cartão de prioridade da operação
function PriorityCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  href: string
  icon: LucideIcon
  label: string
  value: number
  hint: string
  tone: string
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/40">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function DashboardPage() {
  const user = await requireUser()
  // Vendedor tem acesso mínimo: cai direto nas garantias, não vê o dashboard.
  if (user.role === "vendedor") redirect("/garantias")
  const m = await getDashboardMetrics()

  const totalNotasStatus = m.statusNotas.reduce((sum, item) => sum + item.total, 0)
  const totalGarantias = m.totais.garantiasAndamento + m.totais.garantiasConcluidas
  const garantiaProgresso = totalGarantias > 0 ? Math.round((m.totais.garantiasConcluidas / totalGarantias) * 100) : 0

  return (
    <div className="flex flex-col gap-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
            Olá, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Você está conectado como {ROLE_LABELS[user.role as Role]}. Veja o que precisa da sua atenção agora.
          </p>
        </div>
        <Link
          href="/relatorios"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ir para relatórios <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Ações rápidas */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction href="/importar" icon={FileInput} title="Importar NF-e" description="Enviar novas notas fiscais" />
        <QuickAction href="/estoque/conferencia" icon={ScanBarcode} title="Conferir estoque" description="Bipar itens recebidos" />
        <QuickAction href="/estoque/garantia" icon={ShieldCheck} title="Garantias" description="Acompanhar solicitações" />
        <QuickAction href="/reconhecimento" icon={Sparkles} title="Reconhecimento" description="Vincular itens pendentes" />
      </section>

      {/* Prioridades da operação */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Precisa de atenção</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PriorityCard
            href="/estoque/conferencia"
            icon={FileClock}
            label="Aguardando conferência"
            value={m.totais.notasPendentes + m.totais.notasEmConferencia}
            hint="notas na fila de recebimento"
            tone="bg-warning/15 text-warning"
          />
          <PriorityCard
            href="/estoque/conferencia"
            icon={AlertTriangle}
            label="Itens divergentes"
            value={m.totais.itensDivergentes}
            hint="precisam ser resolvidos"
            tone="bg-destructive/15 text-destructive"
          />
          <PriorityCard
            href="/estoque/espera"
            icon={PackageSearch}
            label="Unidades na espera"
            value={m.totais.itensEspera}
            hint="aguardando destino"
            tone="bg-primary/10 text-primary"
          />
          <PriorityCard
            href="/estoque/garantia"
            icon={ShieldCheck}
            label="Garantias em andamento"
            value={m.totais.garantiasAndamento}
            hint={`${m.totais.garantiasConcluidas} já concluídas`}
            tone="bg-success/15 text-success"
          />
        </div>
      </section>

      {/* Pulso da operação */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Pulso da operação</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <NotasVolumeChart data={m.notasPorDia} />
          </div>
          <div className="lg:col-span-2">
            <StatusNotasDonut data={m.statusNotas} />
          </div>
        </div>
      </section>

      {/* Eficiência */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Eficiência e inteligência</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <GaugeCard
            title="Taxa de conferência"
            description="Notas já conferidas"
            value={m.taxaConferencia}
            footer="Percentual das notas que já passaram pela conferência."
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
      </section>

      {/* Produtividade e distribuição */}
      <section className="grid gap-6 lg:grid-cols-3">
        <ProdutividadeChart data={m.produtividade} />
        <TopFornecedoresChart data={m.topFornecedores} />
        <GarantiasStatusChart data={m.garantiasPorStatus} />
      </section>

      {/* Listas recentes */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Últimas notas */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border">
            <div>
              <CardTitle className="text-base">Últimas notas</CardTitle>
              <CardDescription>Progresso de conferência dos recebimentos recentes</CardDescription>
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
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Boxes className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma nota importada. Comece pela tela de importação de NF-e.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {m.ultimasNotas.map((n) => {
                  const total = n.totalItens ?? 0
                  const conferidos = n.itensConferidos ?? 0
                  const pct = total > 0 ? Math.round((conferidos / total) * 100) : 0
                  return (
                    <li key={n.id} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">Nº {n.numero ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {n.fornecedorNome ?? "Sem fornecedor"} · {fmtData(n.createdAt)}
                          </p>
                        </div>
                        <NotaStatusBadge status={n.status} />
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {conferidos}/{total} itens
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Últimas garantias */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border">
            <div>
              <CardTitle className="text-base">Últimas garantias</CardTitle>
              <CardDescription>
                {garantiaProgresso}% das garantias registradas já foram concluídas
              </CardDescription>
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
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Nenhuma garantia aberta ainda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {m.ultimasGarantias.map((g) => (
                  <li key={g.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{g.protocolo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {g.clienteNome} · {g.produtoDescricao}
                      </p>
                      <p className="text-xs text-muted-foreground/70">{fmtData(g.createdAt)}</p>
                    </div>
                    <Badge className={`border ${GARANTIA_TONE[g.status] ?? GARANTIA_TONE.pendente} hover:bg-transparent`}>
                      {GARANTIA_LABELS[g.status] ?? g.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Rodapé informativo, sem dinheiro */}
      <p className="text-center text-xs text-muted-foreground">
        Total de {totalNotasStatus} {totalNotasStatus === 1 ? "nota registrada" : "notas registradas"} · {m.totais.produtos} produtos ativos · {m.totais.fornecedores} fornecedores
      </p>
    </div>
  )
}
