"use server"

import { db } from "@/lib/db"
import { modulosControle, type ControleColuna, type ControleLinha } from "@/lib/db/schema"
import { asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireActor, requireAnyPermission } from "@/lib/guards"
import { registrarLog } from "@/lib/logs"

export type TipoColuna = ControleColuna["tipo"]
export type ColunaControle = ControleColuna
export type LinhaControle = ControleLinha
export type ModuloControle = Omit<typeof modulosControle.$inferSelect, "colunas" | "linhas"> & {
  colunas: ColunaControle[]
  linhas: LinhaControle[]
}
export type ModuloInput = { titulo: string; colunas: ColunaControle[]; linhas: LinhaControle[] }
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function canWrite() {
  return requireAnyPermission("gerenciar_notas", "gerenciar_cadastros", "conferir")
}

function id(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${index}`
}

function normalize(raw: typeof modulosControle.$inferSelect): ModuloControle {
  const rawColumns = raw.colunas as unknown
  const legacyColumns = Array.isArray(rawColumns) && rawColumns.every((column) => typeof column === "string")
  const colunas: ColunaControle[] = legacyColumns
    ? (rawColumns as string[]).map((nome, index) => ({ id: `legacy-${index}`, nome, tipo: index === 0 ? "texto" : "numero" }))
    : ((Array.isArray(rawColumns) ? rawColumns : []) as ColunaControle[])

  const rawRows = raw.linhas as unknown
  const legacyRows = Array.isArray(rawRows) && rawRows.every((row) => Array.isArray(row))
  const linhas: LinhaControle[] = legacyRows
    ? (rawRows as string[][]).map((row, rowIndex) => ({
        id: `legacy-row-${rowIndex}`,
        valores: Object.fromEntries(colunas.map((column, columnIndex) => [column.id, String(row[columnIndex] ?? "")])),
      }))
    : ((Array.isArray(rawRows) ? rawRows : []) as LinhaControle[])

  return { ...raw, colunas, linhas }
}

function sanitize(input: ModuloInput): ModuloInput | null {
  const titulo = input.titulo?.trim()
  if (!titulo || !Array.isArray(input.colunas) || input.colunas.length < 1) return null

  const seen = new Set<string>()
  const colunas = input.colunas.map((column, index) => {
    const nome = column.nome?.trim()
    const key = nome?.toLocaleLowerCase("pt-BR")
    if (!nome || seen.has(key)) return null
    seen.add(key)
    const tipo: TipoColuna = ["texto", "numero", "data", "status"].includes(column.tipo) ? column.tipo : "texto"
    const opcoes = tipo === "status" ? [...new Set((column.opcoes ?? []).map((item) => item.trim()).filter(Boolean))] : undefined
    return { id: column.id || id("col", index), nome, tipo, ...(opcoes?.length ? { opcoes } : {}) } satisfies ColunaControle
  })
  if (colunas.some((column) => !column)) return null
  const validColumns = colunas as ColunaControle[]

  const linhas = (input.linhas ?? []).map((row, rowIndex) => ({
    id: row.id || id("row", rowIndex),
    valores: Object.fromEntries(validColumns.map((column) => [column.id, String(row.valores?.[column.id] ?? "").trim()])),
  }))
  return { titulo, colunas: validColumns, linhas }
}

export async function listModulos(): Promise<ModuloControle[]> {
  await requireActor()
  const rows = await db.select().from(modulosControle).orderBy(asc(modulosControle.ordem), asc(modulosControle.id))
  return rows.map(normalize)
}

export async function createModulo(input: ModuloInput): Promise<ActionResult<{ modulo: ModuloControle }>> {
  try {
    const actor = await canWrite()
    const clean = sanitize(input)
    if (!clean) return { ok: false, error: "Informe o título e configure ao menos uma coluna com nomes únicos." }
    const [last] = await db.select({ ordem: modulosControle.ordem }).from(modulosControle).orderBy(desc(modulosControle.ordem)).limit(1)
    const [row] = await db.insert(modulosControle).values({ ...clean, ordem: (last?.ordem ?? 0) + 1, createdBy: actor.id, createdByNome: actor.name }).returning()
    await registrarLog({ actor, area: "controle", acao: "criou", detalhe: `Criou a tabela livre "${clean.titulo}".` })
    revalidatePath("/estoque/controle")
    return { ok: true, data: { modulo: normalize(row) } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao criar tabela." }
  }
}

export async function updateModulo(idModulo: number, input: ModuloInput): Promise<ActionResult<{ modulo: ModuloControle }>> {
  try {
    const actor = await canWrite()
    const clean = sanitize(input)
    if (!clean) return { ok: false, error: "Revise o título e as colunas da tabela." }
    const [row] = await db.update(modulosControle).set({ ...clean, updatedAt: new Date() }).where(eq(modulosControle.id, idModulo)).returning()
    if (!row) return { ok: false, error: "Tabela não encontrada." }
    await registrarLog({ actor, area: "controle", acao: "editou", detalhe: `Atualizou a tabela livre "${clean.titulo}".` })
    revalidatePath("/estoque/controle")
    return { ok: true, data: { modulo: normalize(row) } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao atualizar tabela." }
  }
}

export async function deleteModulo(idModulo: number): Promise<ActionResult> {
  try {
    const actor = await canWrite()
    const [modulo] = await db.select({ titulo: modulosControle.titulo }).from(modulosControle).where(eq(modulosControle.id, idModulo)).limit(1)
    await db.delete(modulosControle).where(eq(modulosControle.id, idModulo))
    await registrarLog({ actor, area: "controle", acao: "excluiu", detalhe: `Excluiu a tabela livre "${modulo?.titulo ?? `#${idModulo}`}".` })
    revalidatePath("/estoque/controle")
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao remover tabela." }
  }
}
