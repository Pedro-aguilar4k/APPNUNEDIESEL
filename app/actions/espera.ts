"use server"

import { db } from "@/lib/db"
import { esperaItens, produtos } from "@/lib/db/schema"
import { asc, eq, ilike } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"
import { revalidatePath } from "next/cache"
import { isEsperaTipo, type AdicionarEsperaInput, type EsperaItem, type EsperaResult } from "@/lib/espera"

function clean(v?: string | null): string | null {
  const t = (v ?? "").trim()
  return t.length ? t : null
}

/** Busca a descrição no cadastro de produtos, se o código existir lá. */
async function descricaoDoCadastro(codigo: string): Promise<string | null> {
  const [p] = await db
    .select({ descricao: produtos.descricao })
    .from(produtos)
    .where(eq(produtos.codigoInterno, codigo))
    .limit(1)
  return p?.descricao ?? null
}

/** Lista todos os itens da espera (ordem alfabética por código). */
export async function listEspera(): Promise<EsperaItem[]> {
  await requirePermission("conferir")
  return db.select().from(esperaItens).orderBy(asc(esperaItens.codigoInterno))
}

/** Pesquisa por código (parcial). Vazio retorna a lista completa. */
export async function pesquisarEspera(termo: string): Promise<EsperaItem[]> {
  await requirePermission("conferir")
  const t = termo.trim()
  if (!t) return db.select().from(esperaItens).orderBy(asc(esperaItens.codigoInterno))
  return db
    .select()
    .from(esperaItens)
    .where(ilike(esperaItens.codigoInterno, `%${t}%`))
    .orderBy(asc(esperaItens.codigoInterno))
}

/**
 * Adiciona saldo à espera. Se o código já existe, soma as unidades ao total
 * (fonte da verdade) e atualiza os boxes informados. Caso contrário, cria o item.
 * Itens da espera NÃO são cadastrados como produtos; a descrição é apenas puxada
 * do cadastro quando o código casa.
 */
export async function adicionarEspera(input: AdicionarEsperaInput): Promise<EsperaResult> {
  try {
    const actor = await requirePermission("conferir")

    const codigo = clean(input.codigoInterno)
    const boxPrimario = clean(input.boxPrimario)
    if (!codigo) return { ok: false, error: "Informe o código interno." }
    if (!boxPrimario) return { ok: false, error: "Informe o box primário." }
    if (!isEsperaTipo(input.tipo)) return { ok: false, error: "Tipo inválido." }

    const upe = input.tipo === "unidade" ? 1 : Math.floor(input.unidadesPorEmbalagem || 0)
    if (input.tipo !== "unidade" && upe < 1) {
      return { ok: false, error: "Informe quantas unidades cabem em cada embalagem." }
    }

    const qtd = Math.floor(input.quantidade || 0)
    if (qtd < 1) return { ok: false, error: "Informe uma quantidade válida." }

    const unidadesParaAdicionar = input.tipo === "unidade" ? qtd : qtd * upe
    const boxSecundario = clean(input.boxSecundario)

    const [existente] = await db
      .select()
      .from(esperaItens)
      .where(eq(esperaItens.codigoInterno, codigo))
      .limit(1)

    if (existente) {
      await db
        .update(esperaItens)
        .set({
          totalUnidades: existente.totalUnidades + unidadesParaAdicionar,
          boxPrimario,
          boxSecundario,
          // Mantém a embalagem de exibição atualizada se o usuário informou uma nova.
          tipo: input.tipo,
          unidadesPorEmbalagem: upe,
          updatedAt: new Date(),
        })
        .where(eq(esperaItens.id, existente.id))
    } else {
      await db.insert(esperaItens).values({
        codigoInterno: codigo,
        descricao: await descricaoDoCadastro(codigo),
        tipo: input.tipo,
        unidadesPorEmbalagem: upe,
        totalUnidades: unidadesParaAdicionar,
        boxPrimario,
        boxSecundario,
        createdBy: actor.id,
      })
    }

    revalidatePath("/estoque/espera")
    return { ok: true, codigo }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao adicionar à espera." }
  }
}

/**
 * Remove unidades do saldo. O total em unidades é a fonte da verdade; as
 * caixas/pacotes se recalculam automaticamente na exibição. Quando o saldo
 * chega a zero, o registro é removido da espera (única forma de remoção).
 */
export async function removerUnidadesEspera(
  id: number,
  unidades: number,
): Promise<{ ok: boolean; error?: string; zerado?: boolean }> {
  try {
    await requirePermission("conferir")
    const qtd = Math.floor(unidades || 0)
    if (qtd < 1) return { ok: false, error: "Informe uma quantidade válida." }

    const [item] = await db.select().from(esperaItens).where(eq(esperaItens.id, id)).limit(1)
    if (!item) return { ok: false, error: "Item não encontrado." }
    if (qtd > item.totalUnidades) {
      return { ok: false, error: `Saldo insuficiente (disponível: ${item.totalUnidades} un).` }
    }

    const novoTotal = item.totalUnidades - qtd
    if (novoTotal <= 0) {
      // Remoção do registro só acontece quando zera.
      await db.delete(esperaItens).where(eq(esperaItens.id, id))
      revalidatePath("/estoque/espera")
      return { ok: true, zerado: true }
    }

    await db
      .update(esperaItens)
      .set({ totalUnidades: novoTotal, updatedAt: new Date() })
      .where(eq(esperaItens.id, id))
    revalidatePath("/estoque/espera")
    return { ok: true, zerado: false }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao remover unidades." }
  }
}
