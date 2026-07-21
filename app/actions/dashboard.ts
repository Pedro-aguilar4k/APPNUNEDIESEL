"use server"

import { db } from "@/lib/db"
import { notas, itensNota, produtos, fornecedores } from "@/lib/db/schema"
import { and, eq, gte, sql, desc } from "drizzle-orm"
import { requireUser } from "@/lib/session"

export type DashboardMetrics = {
  totais: {
    notasPendentes: number
    notasEmConferencia: number
    notasConferidas: number
    notasDivergentes: number
    produtos: number
    fornecedores: number
  }
  taxaVinculacao: number // % de itens com produto vinculado (últimos 30 dias)
  itensPorMatch: { metodo: string; total: number }[]
  notasPorDia: { dia: string; total: number }[]
  ultimasNotas: {
    id: number
    numero: string | null
    fornecedorNome: string | null
    status: string
    totalItens: number
    itensConferidos: number
    createdAt: Date
  }[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await requireUser()

  const desde = new Date()
  desde.setDate(desde.getDate() - 30)

  const [statusRows, prodCount, fornCount, vincRows, matchRows, diaRows, ultimas] = await Promise.all([
    db
      .select({ status: notas.status, n: sql<number>`count(*)::int` })
      .from(notas)
      .groupBy(notas.status),
    db.select({ n: sql<number>`count(*)::int` }).from(produtos).where(eq(produtos.ativo, true)),
    db.select({ n: sql<number>`count(*)::int` }).from(fornecedores).where(eq(fornecedores.ativo, true)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        vinculados: sql<number>`count(*) filter (where ${itensNota.produtoId} is not null)::int`,
      })
      .from(itensNota)
      .where(gte(itensNota.createdAt, desde)),
    db
      .select({ metodo: sql<string>`coalesce(${itensNota.matchTipo}, 'nenhum')`, total: sql<number>`count(*)::int` })
      .from(itensNota)
      .where(gte(itensNota.createdAt, desde))
      .groupBy(sql`coalesce(${itensNota.matchTipo}, 'nenhum')`),
    db
      .select({
        dia: sql<string>`to_char(${notas.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
      })
      .from(notas)
      .where(gte(notas.createdAt, desde))
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
  ])

  const statusMap = new Map(statusRows.map((r) => [r.status, r.n]))
  const vinc = vincRows[0] ?? { total: 0, vinculados: 0 }

  return {
    totais: {
      notasPendentes: statusMap.get("pendente") ?? 0,
      notasEmConferencia: statusMap.get("em_conferencia") ?? 0,
      notasConferidas: statusMap.get("conferida") ?? 0,
      notasDivergentes: statusMap.get("divergente") ?? 0,
      produtos: prodCount[0]?.n ?? 0,
      fornecedores: fornCount[0]?.n ?? 0,
    },
    taxaVinculacao: vinc.total > 0 ? Math.round((vinc.vinculados / vinc.total) * 100) : 0,
    itensPorMatch: matchRows,
    notasPorDia: diaRows,
    ultimasNotas: ultimas,
  }
}
