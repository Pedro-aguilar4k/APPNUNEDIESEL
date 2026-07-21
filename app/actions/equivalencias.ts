"use server"

import { db } from "@/lib/db"
import { equivalenciaProdutos, produtos } from "@/lib/db/schema"
import { count, desc, eq, ilike, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireActor, requirePermission } from "@/lib/guards"

export type Equivalencia = {
  id: number
  produtoId: number
  produtoDescricao: string | null
  produtoCodigo: string | null
  fornecedorCnpj: string | null
  codigoFornecedor: string | null
  descricaoFornecedor: string | null
  ean: string | null
  vezesUsado: number
  updatedAt: Date
}

export type ActionResult = { ok: true } | { ok: false; error: string }

function clean(v?: string) {
  const t = v?.trim()
  return t ? t : null
}

export async function listEquivalencias(params?: {
  q?: string
  page?: number
  pageSize?: number
}): Promise<{ rows: Equivalencia[]; total: number; page: number; pageSize: number }> {
  await requireActor()
  const page = Math.max(1, params?.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, params?.pageSize ?? 20))
  const q = params?.q?.trim()

  const where = q
    ? or(
        ilike(equivalenciaProdutos.descricaoFornecedor, `%${q}%`),
        ilike(equivalenciaProdutos.codigoFornecedor, `%${q}%`),
        ilike(produtos.descricao, `%${q}%`),
      )
    : undefined

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: equivalenciaProdutos.id,
        produtoId: equivalenciaProdutos.produtoId,
        produtoDescricao: produtos.descricao,
        produtoCodigo: produtos.codigoInterno,
        fornecedorCnpj: equivalenciaProdutos.fornecedorCnpj,
        codigoFornecedor: equivalenciaProdutos.codigoFornecedor,
        descricaoFornecedor: equivalenciaProdutos.descricaoFornecedor,
        ean: equivalenciaProdutos.ean,
        vezesUsado: equivalenciaProdutos.vezesUsado,
        updatedAt: equivalenciaProdutos.updatedAt,
      })
      .from(equivalenciaProdutos)
      .leftJoin(produtos, eq(produtos.id, equivalenciaProdutos.produtoId))
      .where(where)
      .orderBy(desc(equivalenciaProdutos.vezesUsado), desc(equivalenciaProdutos.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(equivalenciaProdutos)
      .leftJoin(produtos, eq(produtos.id, equivalenciaProdutos.produtoId))
      .where(where),
  ])

  return { rows, total: Number(total), page, pageSize }
}

export async function deleteEquivalencia(id: number): Promise<ActionResult> {
  try {
    await requirePermission("gerenciar_cadastros")
    await db.delete(equivalenciaProdutos).where(eq(equivalenciaProdutos.id, id))
    revalidatePath("/equivalencias")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao remover equivalência." }
  }
}

/**
 * Cria ou reforça uma equivalência (produto <- codigo do fornecedor).
 * Usada tanto pela tela de equivalências quanto pelo fluxo de vínculo/aprendizado.
 */
export async function upsertEquivalencia(input: {
  produtoId: number
  fornecedorCnpj?: string
  fornecedorId?: number
  codigoFornecedor?: string
  descricaoFornecedor?: string
  ean?: string
}): Promise<ActionResult> {
  try {
    const actor = await requirePermission("gerenciar_cadastros")
    const fornecedorCnpj = clean(input.fornecedorCnpj)
    const codigoFornecedor = clean(input.codigoFornecedor)

    // Chave natural: fornecedor + codigo. Se já existe, reforça (vezes_usado++).
    if (fornecedorCnpj && codigoFornecedor) {
      const existing = await db
        .select({ id: equivalenciaProdutos.id, vezesUsado: equivalenciaProdutos.vezesUsado })
        .from(equivalenciaProdutos)
        .where(eq(equivalenciaProdutos.fornecedorCnpj, fornecedorCnpj))
        .limit(1)

      const dup = existing.find(() => true)
      if (dup) {
        await db
          .update(equivalenciaProdutos)
          .set({
            produtoId: input.produtoId,
            descricaoFornecedor: clean(input.descricaoFornecedor),
            ean: clean(input.ean),
            vezesUsado: dup.vezesUsado + 1,
            updatedAt: new Date(),
          })
          .where(eq(equivalenciaProdutos.id, dup.id))
        revalidatePath("/equivalencias")
        return { ok: true }
      }
    }

    await db.insert(equivalenciaProdutos).values({
      produtoId: input.produtoId,
      fornecedorId: input.fornecedorId ?? null,
      fornecedorCnpj,
      codigoFornecedor,
      descricaoFornecedor: clean(input.descricaoFornecedor),
      ean: clean(input.ean),
      createdBy: actor.id,
    })
    revalidatePath("/equivalencias")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar equivalência." }
  }
}
