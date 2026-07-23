"use server"

import { db } from "@/lib/db"
import { notas, itensNota, produtos, fornecedores, garantias, esperaItens, relatoriosConferencia } from "@/lib/db/schema"
import { desc, eq, gte, sql } from "drizzle-orm"
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
    garantiasAndamento: number
    garantiasConcluidas: number
    itensDivergentes: number
    itensEspera: number
  }
  taxaVinculacao: number
  taxaConferencia: number
  itensPorMatch: { metodo: string; total: number }[]
  notasPorDia: { dia: string; total: number; conferidas: number }[]
  statusNotas: { status: string; total: number }[]
  garantiasPorStatus: { status: string; total: number }[]
  topFornecedores: { nome: string; notas: number }[]
  produtividade: { estoquista: string; notas: number; itens: number }[]
  ultimasNotas: {
    id: number
    numero: string | null
    fornecedorNome: string | null
    status: string
    totalItens: number | null
    itensConferidos: number | null
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

  const [
    statusRows,
    prodCount,
    fornCount,
    vincRows,
    matchRows,
    diaRows,
    ultimas,
    totalNotasRows,
    notasMesRows,
    garantiaStatusRows,
    itensDivergRow,
    esperaRow,
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
        createdAt: notas.createdAt,
      })
      .from(notas)
      .orderBy(desc(notas.createdAt))
      .limit(8),
    db
      .select({
        total: sql<number>`count(*)::int`,
        conferidas: sql<number>`count(*) filter (where ${notas.status} = 'conferida')::int`,
      })
      .from(notas),
    db.select({ n: sql<number>`count(*)::int` }).from(notas).where(gte(notas.createdAt, inicioMes)),
    db.select({ status: garantias.status, n: sql<number>`count(*)::int` }).from(garantias).groupBy(garantias.status),
    db.select({ n: sql<number>`count(*)::int` }).from(itensNota).where(eq(itensNota.statusConferencia, "divergente")),
    db.select({ n: sql<number>`coalesce(sum(${esperaItens.totalUnidades}), 0)::int` }).from(esperaItens),
    db
      .select({
        nome: sql<string>`coalesce(${notas.fornecedorNome}, 'Sem fornecedor')`,
        notas: sql<number>`count(*)::int`,
      })
      .from(notas)
      .where(gte(notas.createdAt, desde90))
      .groupBy(sql`coalesce(${notas.fornecedorNome}, 'Sem fornecedor')`)
      .orderBy(sql`count(*) desc`)
      .limit(6),
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

  const statusMap = new Map(statusRows.map((row) => [row.status, row.n]))
  const vinculos = vincRows[0] ?? { total: 0, vinculados: 0 }
  const notasHistorico = totalNotasRows[0] ?? { total: 0, conferidas: 0 }
  const garantiaAndamento = garantiaStatusRows
    .filter((row) => row.status !== "concluido")
    .reduce((total, row) => total + row.n, 0)

  return {
    totais: {
      notasPendentes: statusMap.get("pendente") ?? 0,
      notasEmConferencia: statusMap.get("em_conferencia") ?? 0,
      notasConferidas: statusMap.get("conferida") ?? 0,
      notasDivergentes: statusMap.get("divergente") ?? 0,
      produtos: prodCount[0]?.n ?? 0,
      fornecedores: fornCount[0]?.n ?? 0,
      notasMes: notasMesRows[0]?.n ?? 0,
      garantiasAndamento: garantiaAndamento,
      garantiasConcluidas: garantiaStatusRows.find((row) => row.status === "concluido")?.n ?? 0,
      itensDivergentes: itensDivergRow[0]?.n ?? 0,
      itensEspera: esperaRow[0]?.n ?? 0,
    },
    taxaVinculacao:
      vinculos.total > 0 ? Math.round((vinculos.vinculados / vinculos.total) * 100) : 0,
    taxaConferencia:
      notasHistorico.total > 0 ? Math.round((notasHistorico.conferidas / notasHistorico.total) * 100) : 0,
    itensPorMatch: matchRows,
    notasPorDia: diaRows,
    statusNotas: statusRows.map((row) => ({ status: row.status, total: row.n })),
    garantiasPorStatus: garantiaStatusRows.map((row) => ({ status: row.status, total: row.n })),
    topFornecedores: topFornRows,
    produtividade: produtividadeRows,
    ultimasNotas: ultimas,
    ultimasGarantias: ultimasGarantiasRows,
  }
}
