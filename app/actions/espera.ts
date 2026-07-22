"use server"

import { db } from "@/lib/db"
import { account, esperaItens, produtos } from "@/lib/db/schema"
import { and, asc, eq, ilike, ne } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"
import { auth } from "@/lib/auth"
import { registrarLog } from "@/lib/logs"
import { revalidatePath } from "next/cache"
import {
  isEsperaTipo,
  type AdicionarEsperaInput,
  type EsperaItem,
  type EsperaResult,
  type EsperaTipo,
} from "@/lib/espera"

/**
 * Verifica se a senha informada bate com a do usuário (conta de credenciais do
 * Better Auth). Usada para confirmar ações sensíveis, como editar um item.
 */
async function conferirSenhaUsuario(userId: string, senha: string): Promise<boolean> {
  const s = (senha ?? "").trim()
  if (!s) return false
  const [cred] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1)
  if (!cred?.password) return false
  const ctx = await auth.$context
  try {
    return await ctx.password.verify({ hash: cred.password, password: s })
  } catch {
    return false
  }
}

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

    await registrarLog({
      actor,
      area: "espera",
      acao: "adicionou",
      detalhe: `Adicionou ${unidadesParaAdicionar} un do código ${codigo} na espera (box ${boxPrimario}${
        boxSecundario ? ` / ${boxSecundario}` : ""
      }).`,
    })

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
    const actor = await requirePermission("conferir")
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
      await registrarLog({
        actor,
        area: "espera",
        acao: "removeu",
        detalhe: `Removeu ${qtd} un do código ${item.codigoInterno} na espera. Saldo zerado — item retirado da espera.`,
      })
      revalidatePath("/estoque/espera")
      return { ok: true, zerado: true }
    }

    await db
      .update(esperaItens)
      .set({ totalUnidades: novoTotal, updatedAt: new Date() })
      .where(eq(esperaItens.id, id))
    await registrarLog({
      actor,
      area: "espera",
      acao: "removeu",
      detalhe: `Removeu ${qtd} un do código ${item.codigoInterno} na espera (saldo: ${novoTotal} un).`,
    })
    revalidatePath("/estoque/espera")
    return { ok: true, zerado: false }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao remover unidades." }
  }
}

/**
 * Ajuste rápido de saldo (+1 / -1 unidade) para os botões instantâneos da tela.
 * O total em unidades é a fonte da verdade; as caixas/pacotes se recalculam na
 * exibição. Ao zerar, o item sai da espera. Retorna o novo total para a UI.
 */
export async function ajustarSaldoEspera(
  id: number,
  delta: number,
): Promise<{ ok: boolean; error?: string; novoTotal?: number; zerado?: boolean }> {
  try {
    const actor = await requirePermission("conferir")
    const passo = delta > 0 ? 1 : -1

    const [item] = await db.select().from(esperaItens).where(eq(esperaItens.id, id)).limit(1)
    if (!item) return { ok: false, error: "Item não encontrado." }

    const novoTotal = item.totalUnidades + passo
    if (novoTotal < 0) return { ok: false, error: "Saldo já está em zero." }

    if (novoTotal === 0) {
      await db.delete(esperaItens).where(eq(esperaItens.id, id))
      await registrarLog({
        actor,
        area: "espera",
        acao: "removeu",
        detalhe: `Removeu 1 un do código ${item.codigoInterno} na espera. Saldo zerado — item retirado da espera.`,
      })
      revalidatePath("/estoque/espera")
      return { ok: true, novoTotal: 0, zerado: true }
    }

    await db
      .update(esperaItens)
      .set({ totalUnidades: novoTotal, updatedAt: new Date() })
      .where(eq(esperaItens.id, id))
    await registrarLog({
      actor,
      area: "espera",
      acao: passo > 0 ? "adicionou" : "removeu",
      detalhe: `${passo > 0 ? "Adicionou" : "Removeu"} 1 un do código ${item.codigoInterno} na espera (saldo: ${novoTotal} un).`,
    })
    revalidatePath("/estoque/espera")
    return { ok: true, novoTotal, zerado: false }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao ajustar saldo." }
  }
}

/** Entrada da edição completa de um item da espera. */
export type EditarEsperaInput = {
  id: number
  senha: string
  codigoInterno: string
  boxPrimario: string
  boxSecundario?: string
  tipo: EsperaTipo
  unidadesPorEmbalagem?: number
  totalUnidades: number
}

/**
 * Edita todos os campos de um item da espera. Exige a senha do próprio usuário
 * como confirmação (não é uma senha compartilhada — é a mesma do login).
 */
export async function editarEspera(
  input: EditarEsperaInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requirePermission("conferir")

    const senhaOk = await conferirSenhaUsuario(actor.id, input.senha)
    if (!senhaOk) return { ok: false, error: "Senha incorreta. A edição não foi salva." }

    const codigo = clean(input.codigoInterno)
    const boxPrimario = clean(input.boxPrimario)
    if (!codigo) return { ok: false, error: "Informe o código interno." }
    if (!boxPrimario) return { ok: false, error: "Informe o box primário." }
    if (!isEsperaTipo(input.tipo)) return { ok: false, error: "Tipo inválido." }

    const upe = input.tipo === "unidade" ? 1 : Math.floor(input.unidadesPorEmbalagem || 0)
    if (input.tipo !== "unidade" && upe < 1) {
      return { ok: false, error: "Informe quantas unidades cabem em cada embalagem." }
    }

    const total = Math.floor(input.totalUnidades)
    if (!Number.isFinite(total) || total < 0) {
      return { ok: false, error: "Informe um saldo válido (0 ou mais)." }
    }

    const [item] = await db.select().from(esperaItens).where(eq(esperaItens.id, input.id)).limit(1)
    if (!item) return { ok: false, error: "Item não encontrado." }

    // Se o código mudou, garante que não colida com outro item já cadastrado.
    if (codigo !== item.codigoInterno) {
      const [conflito] = await db
        .select({ id: esperaItens.id })
        .from(esperaItens)
        .where(and(eq(esperaItens.codigoInterno, codigo), ne(esperaItens.id, input.id)))
        .limit(1)
      if (conflito) {
        return { ok: false, error: `Já existe outro item na espera com o código ${codigo}.` }
      }
    }

    // Saldo zerado remove o item da espera.
    if (total === 0) {
      await db.delete(esperaItens).where(eq(esperaItens.id, input.id))
      await registrarLog({
        actor,
        area: "espera",
        acao: "editou",
        detalhe: `Editou o código ${item.codigoInterno} e zerou o saldo — item retirado da espera.`,
      })
      revalidatePath("/estoque/espera")
      return { ok: true }
    }

    const boxSecundario = clean(input.boxSecundario)
    await db
      .update(esperaItens)
      .set({
        codigoInterno: codigo,
        descricao: codigo !== item.codigoInterno ? await descricaoDoCadastro(codigo) : item.descricao,
        tipo: input.tipo,
        unidadesPorEmbalagem: upe,
        totalUnidades: total,
        boxPrimario,
        boxSecundario,
        updatedAt: new Date(),
      })
      .where(eq(esperaItens.id, input.id))

    await registrarLog({
      actor,
      area: "espera",
      acao: "editou",
      detalhe: `Editou o item ${codigo} na espera (saldo: ${total} un, box ${boxPrimario}${
        boxSecundario ? ` / ${boxSecundario}` : ""
      }).`,
    })

    revalidatePath("/estoque/espera")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao editar item." }
  }
}
