"use server"

import { db } from "@/lib/db"
import {
  notas,
  itensNota,
  produtos,
  fornecedores,
  garantias,
  esperaItens,
  relatoriosConferencia,
} from "@/lib/db/schema"
import { eq, gte, sql, desc } from "drizzle-orm"
import { requireUser } from "@/lib/session"

export type DashboardMetrics = {
  totais: {
    notasPendentes: number
    notasEmConferencia: number
    notasConferidas: number
    notasDivergentes: number
    produtos: number
    fornecedores: number
    notasMes: number
    valorImportadoMes: number
    garantiasAndamento: number
    garantiasConcluidas: number
    itensDivergentes: number
    itensEspera: number
    valorEstoque: number
  }
  taxaVinculacao: number // % de itens com produto vinculado (últimos 30 dias)
  taxaConferencia: number // % de notas já conferidas (histórico)
  itensPorMatch: { metodo: string; total: number }[]
  notasPorDia: { dia: string; total: number; conferidas: number }[]
  valorPorMes: { mes: string; valor: number }[]
  statusNotas: { status: string; total: number }[]
  garantiasPorStatus: { status: string; total: number }[]
  garantiaProcedencia: { tipo: string; total: number }[]
  topFornecedores: { nome: string; valor: number; notas: number }[]
  produtividade: { estoquista: string; notas: number; itens: number }[]
  ultimasNotas: {
    id: number
    numero: string | null
    fornecedorNome: string | null
    status: string
    totalItens: number | null
    itensConferidos: number | null
    valorTotal: string | null
    createdAt: Date
  }[]
  ultimasGarantias: {
    id: number
    protocolo: string
    clienteNome: string
    produtoDescricao: string
    status: string
    createdAt: Date
  }[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await requireUser()

  const desde30 = new Date()
  desde30.setDate(desde30.getDate() - 30)

  const desde90 = new Date()
  desde90.setDate(desde90.getDate() - 90)

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const inicio6Meses = new Date()
  inicio6Meses.setMonth(inicio6Meses.getMonth() - 5)
  inicio6Meses.setDate(1)
  inicio6Meses.setHours(0, 0, 0, 0)

  const [
    statusRows,
    prodCount,
    fornCount,
    vincRows,
    matchRows,
    diaRows,
    ultimas,
    mesRows,
    valorMesRows,
    notasMesRow,
    garantiaStatusRows,
    garantiaProcRows,
    itensDivergRow,
    esperaRow,
    estoqueRow,
    topFornRows,
    produtividadeRows,
    ultimasGarantiasRows,
  ] = await Promise.all([
    db.select({ status: notas.status, n: sql<number>`count(*)::int` }).from(notas).groupBy(notas.status),
    db.select({ n: sql<number>`count(*)::int` }).from(produtos).where(eq(produtos.ativo, true)),
    db.select({ n: sql<number>`count(*)::int` }).from(fornecedores).where(eq(fornecedores.ativo, true)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        vinculados: sql<number>`count(*) filter (where ${itensNota.produtoId} is not null)::int`,
      })
      .from(itensNota)
      .where(gte(itensNota.createdAt, desde30)),
    db
      .select({ metodo: sql<string>`coalesce(${itensNota.matchTipo}, 'nenhum')`, total: sql<number>`count(*)::int` })
      .from(itensNota)
      .where(gte(itensNota.createdAt, desde30))
      .groupBy(sql`coalesce(${itensNota.matchTipo}, 'nenhum')`),
    db
      .select({
        dia: sql<string>`to_char(${notas.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        conferidas: sql<number>`count(*) filter (where ${notas.status} = 'conferida')::int`,
      })
      .from(notas)
      .where(gte(notas.createdAt, desde30))
      .groupBy(sql`to_char(${notas.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${notas.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({
        id: notas.id,
        numero: notas.numero,
        fornecedorNome: notas.fornecedorNome,
        status: notas.status,
        totalItens: notas.totalItens,
        itensConferidos: notas.itensConferidos,
        valorTotal: notas.valorTotal,
        createdAt: notas.createdAt,
      })
      .from(notas)
      .orderBy(desc(notas.createdAt))
      .limit(8),
    // Contagem total de notas (para taxa de conferência histórica)
    db
      .select({
        total: sql<number>`count(*)::int`,
        conferidas: sql<number>`count(*) filter (where ${notas.status} = 'conferida')::int`,
      })
      .from(notas),
    // Valor importado por mês (últimos 6 meses)
    db
      .select({
        mes: sql<string>`to_char(${notas.createdAt}, 'YYYY-MM')`,
        valor: sql<number>`coalesce(sum(${notas.valorTotal}::numeric), 0)::float`,
      })
      .from(notas)
      .where(gte(notas.createdAt, inicio6Meses))
      .groupBy(sql`to_char(${notas.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${notas.createdAt}, 'YYYY-MM')`),
    // Notas do mês + valor importado do mês
    db
      .select({
        n: sql<number>`count(*)::int`,
        valor: sql<number>`coalesce(sum(${notas.valorTotal}::numeric), 0)::float`,
      })
      .from(notas)
      .where(gte(notas.createdAt, inicioMes)),
    // Garantias por status
    db.select({ status: garantias.status, n: sql<number>`count(*)::int` }).from(garantias).groupBy(garantias.status),
    // Procedência das garantias concluídas
    db
      .select({ tipo: sql<string>`coalesce(${garantias.procedencia}, 'sem_analise')`, n: sql<number>`count(*)::int` })
      .from(garantias)
      .groupBy(sql`coalesce(${garantias.procedencia}, 'sem_analise')`),
    // Itens divergentes (a resolver)
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(itensNota)
      .where(eq(itensNota.statusConferencia, "divergente")),
    // Total de unidades na espera
    db.select({ n: sql<number>`coalesce(sum(${esperaItens.totalUnidades}), 0)::int` }).from(esperaItens),
    // Valor estimado em estoque (custo * quantidade)
    db
      .select({
        v: sql<number>`coalesce(sum(coalesce(${produtos.precoCusto}::numeric, 0) * coalesce(${produtos.estoqueAtual}, 0)), 0)::float`,
      })
      .from(produtos)
      .where(eq(produtos.ativo, true)),
    // Top fornecedores por valor (últimos 90 dias)
    db
      .select({
        nome: sql<string>`coalesce(${notas.fornecedorNome}, 'Sem fornecedor')`,
        valor: sql<number>`coalesce(sum(${notas.valorTotal}::numeric), 0)::float`,
        notas: sql<number>`count(*)::int`,
      })
      .from(notas)
      .where(gte(notas.createdAt, desde90))
      .groupBy(sql`coalesce(${notas.fornecedorNome}, 'Sem fornecedor')`)
      .orderBy(sql`coalesce(sum(${notas.valorTotal}::numeric), 0) desc`)
      .limit(6),
    // Produtividade por estoquista (relatórios de conferência, últimos 90 dias)
    db
      .select({
        estoquista: relatoriosConferencia.estoquista,
        notas: sql<number>`count(*)::int`,
        itens: sql<number>`coalesce(sum(${relatoriosConferencia.itensConferidos}), 0)::int`,
      })
      .from(relatoriosConferencia)
      .where(gte(relatoriosConferencia.createdAt, desde90))
      .groupBy(relatoriosConferencia.estoquista)
      .orderBy(sql`count(*) desc`)
      .limit(6),
    // Últimas garantias
    db
      .select({
        id: garantias.id,
        protocolo: garantias.protocolo,
        clienteNome: garantias.clienteNome,
        produtoDescricao: garantias.produtoDescricao,
        status: garantias.status,
        createdAt: garantias.createdAt,
      })
      .from(garantias)
      .orderBy(desc(garantias.createdAt))
      .limit(6),
  ])

  const statusMap = new Map(statusRows.map((r) => [r.status, r.n]))
  const vinc = vincRows[0] ?? { total: 0, vinculados: 0 }
  const mes = mesRows[0] ?? { total: 0, conferidas: 0 }
  const notasMes = notasMesRow[0] ?? { n: 0, valor: 0 }

  const garantiaAndamento = garantiaStatusRows
    .filter((r) => r.status !== "concluido")
    .reduce((acc, r) => acc + r.n, 0)
  const garantiaConcluidas = garantiaStatusRows.find((r) => r.status === "concluido")?.n ?? 0

  return {
    totais: {
      notasPendentes: statusMap.get("pendente") ?? 0,
      notasEmConferencia: statusMap.get("em_conferencia") ?? 0,
      notasConferidas: statusMap.get("conferida") ?? 0,
      notasDivergentes: statusMap.get("divergente") ?? 0,
      produtos: prodCount[0]?.n ?? 0,
      fornecedores: fornCount[0]?.n ?? 0,
      notasMes: notasMes.n,
      valorImportadoMes: notasMes.valor,
      garantiasAndamento: garantiaAndamento,
      garantiasConcluidas: garantiaConcluidas,
      itensDivergentes: itensDivergRow[0]?.n ?? 0,
      itensEspera: esperaRow[0]?.n ?? 0,
      valorEstoque: estoqueRow[0]?.v ?? 0,
    },
    taxaVinculacao: vinc.total > 0 ? Math.round((vinc.vinculados / vinc.total) * 100) : 0,
    taxaConferencia: mes.total > 0 ? Math.round((mes.conferidas / mes.total) * 100) : 0,
    itensPorMatch: matchRows,
    notasPorDia: diaRows,
    valorPorMes: valorMesRows,
    statusNotas: statusRows.map((r) => ({ status: r.status, total: r.n })),
    garantiasPorStatus: garantiaStatusRows.map((r) => ({ status: r.status, total: r.n })),
    garantiaProcedencia: garantiaProcRows.map((r) => ({ tipo: r.tipo, total: r.n })),
    topFornecedores: topFornRows,
    produtividade: produtividadeRows,
    ultimasNotas: ultimas,
    ultimasGarantias: ultimasGarantiasRows,
  }
}
