"use client"

import { useMemo } from "react"
import { CheckCircle2, ArrowUp, ArrowDown, PackageX, HelpCircle, MapPin, ListChecks, FileSpreadsheet, Percent } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { construirResumoCliente } from "@/components/auditoria/auditoria-resumo"
import type { Contagem, LinhaOficial } from "@/app/actions/auditoria"

function Stat({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span>
        <div>
          <strong className="text-2xl tabular-nums leading-none">{value}</strong>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function AuditoriaDashboard({ contagens, oficial }: { contagens: Contagem[]; oficial: LinhaOficial[] }) {
  const resumo = useMemo(() => construirResumoCliente(oficial, contagens), [oficial, contagens])

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-3 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="size-4 text-primary" />
              <span className="font-medium">Progresso da conferência</span>
            </div>
            <span className="text-2xl font-semibold tabular-nums">{resumo.percentualConcluido}%</span>
          </div>
          <Progress value={resumo.percentualConcluido} />
          <p className="text-sm text-muted-foreground">
            {resumo.totalConferidos} de {resumo.totalImportados} itens do estoque oficial já conferidos.
            {oficial.length === 0 ? " Importe o estoque oficial para calcular o progresso." : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Stat icon={ListChecks} label="Produtos conferidos" value={resumo.totalConferidos} tone="bg-primary/10 text-primary" />
        <Stat icon={FileSpreadsheet} label="Produtos importados" value={resumo.totalImportados} tone="bg-muted text-muted-foreground" />
        <Stat icon={CheckCircle2} label="Produtos corretos" value={resumo.corretos} tone="bg-success/10 text-success" />
        <Stat icon={ArrowDown} label="Produtos com falta" value={resumo.faltas} tone="bg-destructive/10 text-destructive" />
        <Stat icon={ArrowUp} label="Produtos com sobra" value={resumo.sobras} tone="bg-warning/10 text-warning" />
        <Stat icon={MapPin} label="Em múltiplas localizações" value={resumo.multiplasLocalizacoes} tone="bg-amber-500/10 text-amber-600 dark:text-amber-500" />
        <Stat icon={PackageX} label="Não encontrados" value={resumo.naoEncontrados} tone="bg-destructive/10 text-destructive" />
        <Stat icon={HelpCircle} label="Sem cadastro no oficial" value={resumo.semCadastro} tone="bg-muted text-muted-foreground" />
      </div>
    </div>
  )
}
