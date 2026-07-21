"use server"

import { db } from "@/lib/db"
import { produtos } from "@/lib/db/schema"
import { and, desc, eq, ilike, or, sql, count } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireActor, requirePermission } from "@/lib/guards"

export type Produto = typeof produtos.$inferSelect

export type ProdutoInput = {
  codigoInterno: string
  descricao: string
  codigoBarras?: string
  fabricante?: string
  codigoFabricante?: string
  ncm?: string
  unidade?: string
  precoCusto?: string
  precoVenda?: string
  estoqueAtual?: number
  localizacao?: string
  ativo?: boolean
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function clean(v?: string) {
  const t = v?.trim()
  return t ? t : null
}

export async function listProdutos(params?: {
  q?: string
  page?: number
  pageSize?: number
}): Promise<{ rows: Produto[]; total: number; page: number; pageSize: number }> {
  await requireActor()
  const page = Math.max(1, params?.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, params?.pageSize ?? 20))
  const q = params?.q?.trim()

  const where = q
    ? or(
        ilike(produtos.descricao, `%${q}%`),
        ilike(produtos.codigoInterno, `%${q}%`),
        ilike(produtos.codigoBarras, `%${q}%`),
        ilike(produtos.codigoFabricante, `%${q}%`),
      )
    : undefined

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(produtos)
      .where(where)
      .orderBy(desc(produtos.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(produtos).where(where),
  ])

  return { rows, total: Number(total), page, pageSize }
}

export async function createProduto(input: ProdutoInput): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await requirePermission("gerenciar_cadastros")
    const codigoInterno = input.codigoInterno.trim()
    const descricao = input.descricao.trim()
    if (!codigoInterno || !descricao) {
      return { ok: false, error: "Código interno e descrição são obrigatórios." }
    }

    const existing = await db
      .select({ id: produtos.id })
      .from(produtos)
      .where(eq(produtos.codigoInterno, codigoInterno))
      .limit(1)
    if (existing.length) {
      return { ok: false, error: "Já existe um produto com este código interno." }
    }

    const [row] = await db
      .insert(produtos)
      .values({
        codigoInterno,
        descricao,
        codigoBarras: clean(input.codigoBarras),
        fabricante: clean(input.fabricante),
        codigoFabricante: clean(input.codigoFabricante),
        ncm: clean(input.ncm),
        unidade: clean(input.unidade) ?? "UN",
        precoCusto: clean(input.precoCusto),
        precoVenda: clean(input.precoVenda),
        estoqueAtual: input.estoqueAtual ?? 0,
        localizacao: clean(input.localizacao),
        ativo: input.ativo ?? true,
        createdBy: actor.id,
      })
      .returning({ id: produtos.id })

    revalidatePath("/produtos")
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar produto." }
  }
}

export async function updateProduto(id: number, input: ProdutoInput): Promise<ActionResult> {
  try {
    await requirePermission("gerenciar_cadastros")
    const codigoInterno = input.codigoInterno.trim()
    const descricao = input.descricao.trim()
    if (!codigoInterno || !descricao) {
      return { ok: false, error: "Código interno e descrição são obrigatórios." }
    }

    const dup = await db
      .select({ id: produtos.id })
      .from(produtos)
      .where(and(eq(produtos.codigoInterno, codigoInterno), sql`${produtos.id} <> ${id}`))
      .limit(1)
    if (dup.length) {
      return { ok: false, error: "Já existe outro produto com este código interno." }
    }

    await db
      .update(produtos)
      .set({
        codigoInterno,
        descricao,
        codigoBarras: clean(input.codigoBarras),
        fabricante: clean(input.fabricante),
        codigoFabricante: clean(input.codigoFabricante),
        ncm: clean(input.ncm),
        unidade: clean(input.unidade) ?? "UN",
        precoCusto: clean(input.precoCusto),
        precoVenda: clean(input.precoVenda),
        estoqueAtual: input.estoqueAtual ?? 0,
        localizacao: clean(input.localizacao),
        ativo: input.ativo ?? true,
        updatedAt: new Date(),
      })
      .where(eq(produtos.id, id))

    revalidatePath("/produtos")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar produto." }
  }
}

export async function deleteProduto(id: number): Promise<ActionResult> {
  try {
    await requirePermission("gerenciar_cadastros")
    await db.delete(produtos).where(eq(produtos.id, id))
    revalidatePath("/produtos")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao remover produto." }
  }
}
