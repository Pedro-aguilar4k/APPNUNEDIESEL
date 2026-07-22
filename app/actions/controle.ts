"use server"

import { db } from "@/lib/db"
import { modulosControle } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireActor, requireAnyPermission } from "@/lib/guards"
import { registrarLog } from "@/lib/logs"

export type ModuloControle = typeof modulosControle.$inferSelect

export type ModuloInput = {
  titulo: string
  colunas: string[]
  linhas: string[][]
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

// Escrita liberada para quem opera estoque/compras: gerente, comprador, estoquista
// e admin (que tem acesso total). Leitura para qualquer sessão com acesso à área.
function canWrite() {
  return requireAnyPermission("gerenciar_notas", "gerenciar_cadastros", "conferir")
}

function sanitize(input: ModuloInput): { titulo: string; colunas: string[]; linhas: string[][] } | null {
  const titulo = input.titulo?.trim()
  if (!titulo) return null

  const colunas = (input.colunas ?? []).map((c) => c?.trim() ?? "")
  if (colunas.length < 2) return null

  const linhas = (input.linhas ?? []).map((linha) =>
    colunas.map((_, i) => (linha?.[i] ?? "").toString().trim()),
  )

  return { titulo, colunas, linhas }
}

export async function listModulos(): Promise<ModuloControle[]> {
  await requireActor()
  return db.select().from(modulosControle).orderBy(asc(modulosControle.ordem), asc(modulosControle.id))
}

export async function createModulo(input: ModuloInput): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await canWrite()
    const clean = sanitize(input)
    if (!clean) {
      return { ok: false, error: "Informe um título e pelo menos duas colunas (rótulo + 1 valor)." }
    }

    const [{ maxOrdem }] = await db
      .select({ maxOrdem: modulosControle.ordem })
      .from(modulosControle)
      .orderBy(asc(modulosControle.ordem))
      .limit(1)
      .then((rows) => (rows.length ? rows : [{ maxOrdem: 0 }]))

    const [row] = await db
      .insert(modulosControle)
      .values({
        titulo: clean.titulo,
        colunas: clean.colunas,
        linhas: clean.linhas,
        ordem: (maxOrdem ?? 0) + 1,
        createdBy: actor.id,
        createdByNome: actor.name,
      })
      .returning({ id: modulosControle.id })

    await registrarLog({
      actor,
      area: "controle",
      acao: "criou",
      detalhe: `Criou o módulo de controle "${clean.titulo}".`,
    })

    revalidatePath("/estoque/controle")
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar módulo." }
  }
}

export async function updateModulo(id: number, input: ModuloInput): Promise<ActionResult> {
  try {
    const actor = await canWrite()
    const clean = sanitize(input)
    if (!clean) {
      return { ok: false, error: "Informe um título e pelo menos duas colunas (rótulo + 1 valor)." }
    }

    await db
      .update(modulosControle)
      .set({
        titulo: clean.titulo,
        colunas: clean.colunas,
        linhas: clean.linhas,
        updatedAt: new Date(),
      })
      .where(eq(modulosControle.id, id))

    await registrarLog({
      actor,
      area: "controle",
      acao: "editou",
      detalhe: `Editou o módulo de controle "${clean.titulo}".`,
    })

    revalidatePath("/estoque/controle")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar módulo." }
  }
}

export async function deleteModulo(id: number): Promise<ActionResult> {
  try {
    const actor = await canWrite()
    const [m] = await db
      .select({ titulo: modulosControle.titulo })
      .from(modulosControle)
      .where(eq(modulosControle.id, id))
      .limit(1)

    await db.delete(modulosControle).where(eq(modulosControle.id, id))

    await registrarLog({
      actor,
      area: "controle",
      acao: "excluiu",
      detalhe: `Excluiu o módulo de controle "${m?.titulo ?? `#${id}`}".`,
    })

    revalidatePath("/estoque/controle")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao remover módulo." }
  }
}
