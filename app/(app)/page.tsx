import Link from "next/link"
import { requireUser } from "@/lib/session"
import { ROLE_LABELS, type Role } from "@/lib/permissions"
import { getDashboardMetrics } from "@/app/actions/dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MatchChart } from "@/components/dashboard/match-chart"
import { NotaStatusBadge } from "@/components/status-badge"
import { FileClock, Loader2, CheckCircle2, AlertTriangle, Package, Building2, ArrowRight } from "lucide-react"

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: typeof Package
  tone: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const user = await requireUser()
  const m = await getDashboardMetrics()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
          Bem-vindo, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Você está conectado como {ROLE_LABELS[user.role as Role]}. Aqui está o resumo da operação.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Pendentes" value={m.totais.notasPendentes} icon={FileClock} tone="bg-warning/15 text-warning" />
        <Kpi
          label="Em conferência"
          value={m.totais.notasEmConferencia}
          icon={Loader2}
          tone="bg-primary/10 text-primary"
        />
        <Kpi label="Conferidas" value={m.totais.notasConferidas} icon={CheckCircle2} tone="bg-success/15 text-success" />
        <Kpi
          label="Divergentes"
          value={m.totais.notasDivergentes}
          icon={AlertTriangle}
          tone="bg-destructive/15 text-destructive"
        />
        <Kpi label="Produtos" value={m.totais.produtos} icon={Package} tone="bg-muted text-muted-foreground" />
        <Kpi label="Fornecedores" value={m.totais.fornecedores} icon={Building2} tone="bg-muted text-muted-foreground" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MatchChart data={m.itensPorMatch} />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Taxa de vínculo automático</CardTitle>
            <CardDescription>Itens vinculados automaticamente nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-6">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg className="h-40 w-40 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(m.taxaVinculacao / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                />
              </svg>
              <span className="absolute text-3xl font-semibold tabular-nums text-foreground">
                {m.taxaVinculacao}%
              </span>
            </div>
            <p className="text-center text-sm text-muted-foreground text-pretty">
              Quanto mais o sistema aprende com as conferências, maior essa taxa.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Últimas notas</CardTitle>
            <CardDescription>Notas importadas recentemente</CardDescription>
          </div>
          <Link
            href="/conferencia"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver conferência <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </CardHeader>
        <CardContent>
          {m.ultimasNotas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma nota importada. Comece pela tela de importação de NF-e.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Nota</th>
                    <th className="pb-2 pr-4 font-medium">Fornecedor</th>
                    <th className="pb-2 pr-4 font-medium">Progresso</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.ultimasNotas.map((n) => (
                    <tr key={n.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 font-medium text-foreground">Nº {n.numero ?? "—"}</td>
                      <td className="max-w-[220px] truncate py-3 pr-4 text-muted-foreground">
                        {n.fornecedorNome ?? "—"}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                        {n.itensConferidos ?? 0}/{n.totalItens ?? 0}
                      </td>
                      <td className="py-3">
                        <NotaStatusBadge status={n.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
