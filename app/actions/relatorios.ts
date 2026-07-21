"use server"

import { db } from "@/lib/db"
import { notas } from "@/lib/db/schema"
import { and, gte, lte, eq, desc, sql, ilike } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"

export type RelatorioNota = {
  id: number
  numero: string | null
  fornecedorNome: string | null
  fornecedorCnpj: string | null
  status: string
  totalItens: number
  itensConferidos: number
  valorTotal: string | null
  createdAt: Date
}

export async function getRelatorioNotas(input?: {
  status?: string
  de?: string
  ate?: string
  numero?: string
}): Promise<{ notas: RelatorioNota[]; resumo: { total: number; conferidas: number; divergentes: number; itens: number } }> {
  await requirePermission("relatorios")

  const conds = []
  if (input?.status && input.status !== "todos") conds.push(eq(notas.status, input.status))
  if (input?.numero?.trim()) conds.push(ilike(notas.numero, `%${input.numero.trim()}%`))
  if (input?.de) conds.push(gte(notas.createdAt, new Date(input.de)))
  if (input?.ate) {
    const ate = new Date(input.ate)
    ate.setHours(23, 59, 59, 999)
    conds.push(lte(notas.createdAt, ate))
  }
  const where = conds.length ? and(...conds) : undefined

  const rows = await db
    .select({
      id: notas.id,
      numero: notas.numero,
      fornecedorNome: notas.fornecedorNome,
      fornecedorCnpj: notas.fornecedorCnpj,
      status: notas.status,
      totalItens: notas.totalItens,
      itensConferidos: notas.itensConferidos,
      valorTotal: notas.valorTotal,
      createdAt: notas.createdAt,
    })
    .from(notas)
    .where(where)
    .orderBy(desc(notas.createdAt))
    .limit(500)

  const [resumo] = await db
    .select({
      total: sql<number>`count(*)::int`,
      conferidas: sql<number>`count(*) filter (where ${notas.status} = 'conferida')::int`,
      divergentes: sql<number>`count(*) filter (where ${notas.status} = 'divergente')::int`,
      itens: sql<number>`coalesce(sum(${notas.totalItens}), 0)::int`,
    })
    .from(notas)
    .where(where)

  return {
    notas: rows.map((r) => ({
      ...r,
      totalItens: r.totalItens ?? 0,
      itensConferidos: r.itensConferidos ?? 0,
    })),
    resumo: resumo ?? { total: 0, conferidas: 0, divergentes: 0, itens: 0 },
  }
}
