"use server"

import { db } from "@/lib/db"
import { fornecedores } from "@/lib/db/schema"
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireActor, requirePermission } from "@/lib/guards"

export type Fornecedor = typeof fornecedores.$inferSelect

export type FornecedorInput = {
  cnpj?: string
  razaoSocial: string
  nomeFantasia?: string
  email?: string
  telefone?: string
  ativo?: boolean
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function clean(v?: string) {
  const t = v?.trim()
  return t ? t : null
}
function onlyDigits(v?: string) {
  const t = v?.replace(/\D/g, "")
  return t ? t : null
}

export async function listFornecedores(params?: {
  q?: string
  page?: number
  pageSize?: number
}): Promise<{ rows: Fornecedor[]; total: number; page: number; pageSize: number }> {
  await requireActor()
  const page = Math.max(1, params?.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, params?.pageSize ?? 20))
  const q = params?.q?.trim()

  const where = q
    ? or(
        ilike(fornecedores.razaoSocial, `%${q}%`),
        ilike(fornecedores.nomeFantasia, `%${q}%`),
        ilike(fornecedores.cnpj, `%${q}%`),
      )
    : undefined

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(fornecedores)
      .where(where)
      .orderBy(desc(fornecedores.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(fornecedores).where(where),
  ])

  return { rows, total: Number(total), page, pageSize }
}

export async function createFornecedor(input: FornecedorInput): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await requirePermission("gerenciar_cadastros")
    const razaoSocial = input.razaoSocial.trim()
    if (!razaoSocial) return { ok: false, error: "A razão social é obrigatória." }

    const cnpj = onlyDigits(input.cnpj)
    if (cnpj) {
      const dup = await db
        .select({ id: fornecedores.id })
        .from(fornecedores)
        .where(eq(fornecedores.cnpj, cnpj))
        .limit(1)
      if (dup.length) return { ok: false, error: "Já existe um fornecedor com este CNPJ." }
    }

    const [row] = await db
      .insert(fornecedores)
      .values({
        cnpj,
        razaoSocial,
        nomeFantasia: clean(input.nomeFantasia),
        email: clean(input.email),
        telefone: clean(input.telefone),
        ativo: input.ativo ?? true,
        createdBy: actor.id,
      })
      .returning({ id: fornecedores.id })

    revalidatePath("/fornecedores")
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar fornecedor." }
  }
}

export async function updateFornecedor(id: number, input: FornecedorInput): Promise<ActionResult> {
  try {
    await requirePermission("gerenciar_cadastros")
    const razaoSocial = input.razaoSocial.trim()
    if (!razaoSocial) return { ok: false, error: "A razão social é obrigatória." }

    const cnpj = onlyDigits(input.cnpj)
    if (cnpj) {
      const dup = await db
        .select({ id: fornecedores.id })
        .from(fornecedores)
        .where(and(eq(fornecedores.cnpj, cnpj), sql`${fornecedores.id} <> ${id}`))
        .limit(1)
      if (dup.length) return { ok: false, error: "Já existe outro fornecedor com este CNPJ." }
    }

    await db
      .update(fornecedores)
      .set({
        cnpj,
        razaoSocial,
        nomeFantasia: clean(input.nomeFantasia),
        email: clean(input.email),
        telefone: clean(input.telefone),
        ativo: input.ativo ?? true,
        updatedAt: new Date(),
      })
      .where(eq(fornecedores.id, id))

    revalidatePath("/fornecedores")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar fornecedor." }
  }
}

export async function deleteFornecedor(id: number): Promise<ActionResult> {
  try {
    await requirePermission("gerenciar_cadastros")
    await db.delete(fornecedores).where(eq(fornecedores.id, id))
    revalidatePath("/fornecedores")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao remover fornecedor." }
  }
}
