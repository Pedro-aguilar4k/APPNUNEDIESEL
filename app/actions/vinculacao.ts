"use server"

import { db } from "@/lib/db"
import { notas, itensNota, produtos, equivalenciaProdutos, historicoAprendizado, user } from "@/lib/db/schema"
import { and, eq, inArray, sql } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"
import { revalidatePath } from "next/cache"

function clean(v?: string | null) {
  const t = v?.trim()
  return t ? t : null
}

export type VinculacaoItem = {
  id: number
  codigoFornecedor: string | null
  descricaoFornecedor: string | null
  ean: string | null
  ncm: string | null
  quantidade: string
  unidade: string | null
  valorUnitario: string | null
  valorTotal: string | null
  icms: string | null
  ipi: string | null
  impostos: string | null
  produtoId: number | null
  matchTipo: string | null
  matchScore: number | null
  produtoCodigoInterno: string | null
  produtoDescricao: string | null
  devolucao: boolean
  compradorId: string | null
  compradorNome: string | null
  quantidadeOriginal: string | null
  justificativaQuantidade: string | null
}

export type Comprador = { id: string; name: string }

export type VinculacaoData = {
  nota: {
    id: number
    numero: string | null
    serie: string | null
    chaveAcesso: string | null
    fornecedorNome: string | null
    fornecedorCnpj: string | null
    dataEmissao: Date | null
    valorTotal: string | null
    totalItens: number | null
    status: string
  }
  itens: VinculacaoItem[]
}

/** Carrega a nota e seus itens com o produto vinculado (se houver). */
export async function getVinculacaoData(notaId: number): Promise<VinculacaoData | null> {
  await requirePermission("gerenciar_notas")

  const [nota] = await db.select().from(notas).where(eq(notas.id, notaId)).limit(1)
  if (!nota) return null

  const rows = await db
    .select({
      id: itensNota.id,
      codigoFornecedor: itensNota.codigoFornecedor,
      descricaoFornecedor: itensNota.descricaoFornecedor,
      ean: itensNota.ean,
      ncm: itensNota.ncm,
      quantidade: itensNota.quantidade,
      unidade: itensNota.unidade,
      valorUnitario: itensNota.valorUnitario,
      valorTotal: itensNota.valorTotal,
      icms: itensNota.icms,
      ipi: itensNota.ipi,
      impostos: itensNota.impostos,
      produtoId: itensNota.produtoId,
      matchTipo: itensNota.matchTipo,
      matchScore: itensNota.matchScore,
      produtoCodigoInterno: produtos.codigoInterno,
      produtoDescricao: produtos.descricao,
      devolucao: itensNota.devolucao,
      compradorId: itensNota.compradorId,
      compradorNome: itensNota.compradorNome,
      quantidadeOriginal: itensNota.quantidadeOriginal,
      justificativaQuantidade: itensNota.justificativaQuantidade,
    })
    .from(itensNota)
    .leftJoin(produtos, eq(itensNota.produtoId, produtos.id))
    .where(eq(itensNota.notaId, notaId))
    .orderBy(itensNota.id)

  return {
    nota: {
      id: nota.id,
      numero: nota.numero,
      serie: nota.serie,
      chaveAcesso: nota.chaveAcesso,
      fornecedorNome: nota.fornecedorNome,
      fornecedorCnpj: nota.fornecedorCnpj,
      dataEmissao: nota.dataEmissao,
      valorTotal: nota.valorTotal,
      totalItens: nota.totalItens,
      status: nota.status,
    },
    itens: rows,
  }
}

export type ProdutoLookup = {
  id: number
  codigoInterno: string
  descricao: string
  codigoBarras: string | null
  unidade: string | null
}

/** Busca produtos por uma lista de códigos internos (para preview na vinculação). */
export async function buscarProdutosPorCodigos(
  codigos: string[],
): Promise<Record<string, ProdutoLookup>> {
  await requirePermission("gerenciar_notas")
  const limpos = Array.from(new Set(codigos.map((c) => c.trim()).filter(Boolean)))
  if (!limpos.length) return {}

  const rows = await db
    .select({
      id: produtos.id,
      codigoInterno: produtos.codigoInterno,
      descricao: produtos.descricao,
      codigoBarras: produtos.codigoBarras,
      unidade: produtos.unidade,
    })
    .from(produtos)
    .where(sql`${produtos.codigoInterno} = ANY(${limpos})`)

  const map: Record<string, ProdutoLookup> = {}
  for (const r of rows) map[r.codigoInterno] = r
  return map
}

/** Lista os usuários com papel "comprador" (para entregar a peça). */
export async function listCompradores(): Promise<Comprador[]> {
  await requirePermission("gerenciar_notas")
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.role, "comprador"), sql`${user.banned} is not true`))
    .orderBy(user.name)
  return rows
}

export type VinculacaoEntrada = {
  itemId: number
  codigoInterno: string
  devolucao: boolean
  compradorId: string | null
  quantidade: string
  justificativaQuantidade: string | null
}

export type SalvarVinculacoesResult =
  | { ok: true; criados: number; vinculados: number }
  | { ok: false; error: string }

/**
 * Persiste a vinculação de todos os itens informados:
 * - cria o produto automaticamente quando o código interno ainda não existe
 *   (usando os dados do item da nota: descrição, EAN, NCM, unidade, custo);
 * - vincula o item ao produto;
 * - registra/atualiza a equivalência (fornecedor + código do fornecedor -> produto)
 *   para reconhecimento automático nas próximas notas.
 */
export async function salvarVinculacoes(
  notaId: number,
  entradas: VinculacaoEntrada[],
): Promise<SalvarVinculacoesResult> {
  try {
    const actor = await requirePermission("gerenciar_notas")

    const [nota] = await db.select().from(notas).where(eq(notas.id, notaId)).limit(1)
    if (!nota) return { ok: false, error: "Nota não encontrada." }

    const itens = await db.select().from(itensNota).where(eq(itensNota.notaId, notaId))
    const itemMap = new Map(itens.map((i) => [i.id, i]))

    // Resolve os nomes dos compradores selecionados (para exibir na conferência).
    const compradorIds = Array.from(
      new Set(entradas.map((e) => e.compradorId).filter((v): v is string => !!v)),
    )
    const compradorNomeMap = new Map<string, string>()
    if (compradorIds.length) {
      const compradores = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, compradorIds))
      for (const c of compradores) compradorNomeMap.set(c.id, c.name)
    }

    // Valida justificativa obrigatória ao alterar a quantidade.
    for (const entrada of entradas) {
      const item = itemMap.get(entrada.itemId)
      if (!item) continue
      const novaQtd = Number(entrada.quantidade)
      if (Number.isFinite(novaQtd) && novaQtd !== Number(item.quantidade)) {
        if (!entrada.justificativaQuantidade?.trim()) {
          return {
            ok: false,
            error: `Informe a justificativa para alterar a quantidade de "${item.descricaoFornecedor ?? "item"}".`,
          }
        }
        if (novaQtd <= 0) {
          return { ok: false, error: "A quantidade deve ser maior que zero." }
        }
      }
    }

    let criados = 0
    let vinculados = 0

    for (const entrada of entradas) {
      const codigo = entrada.codigoInterno?.trim()
      const item = itemMap.get(entrada.itemId)
      if (!codigo || !item) continue

      // Localiza (ou cria) o produto pelo código interno.
      let [produto] = await db
        .select()
        .from(produtos)
        .where(eq(produtos.codigoInterno, codigo))
        .limit(1)

      if (!produto) {
        const [novo] = await db
          .insert(produtos)
          .values({
            codigoInterno: codigo,
            descricao: clean(item.descricaoFornecedor) ?? codigo,
            codigoBarras: clean(item.ean),
            ncm: clean(item.ncm),
            unidade: clean(item.unidade) ?? "UN",
            precoCusto: clean(item.valorUnitario),
            codigoFabricante: clean(item.codigoFornecedor),
            ativo: true,
            createdBy: actor.id,
          })
          .returning()
        produto = novo
        criados++
      } else if (!produto.codigoBarras && item.ean) {
        // O EAN ajuda a identificar o produto: preenche se estava vazio.
        await db
          .update(produtos)
          .set({ codigoBarras: item.ean, updatedAt: new Date() })
          .where(eq(produtos.id, produto.id))
      }

      // Trata alteração de quantidade (com justificativa) preservando o original.
      const novaQtd = Number(entrada.quantidade)
      const qtdMudou = Number.isFinite(novaQtd) && novaQtd !== Number(item.quantidade)
      const quantidadeFinal = qtdMudou ? String(novaQtd) : item.quantidade
      const quantidadeOriginal = qtdMudou
        ? (item.quantidadeOriginal ?? item.quantidade)
        : item.quantidadeOriginal
      const justificativa = qtdMudou ? (entrada.justificativaQuantidade?.trim() ?? null) : item.justificativaQuantidade

      // Vincula o item ao produto e grava devolução, comprador e quantidade.
      await db
        .update(itensNota)
        .set({
          produtoId: produto.id,
          matchTipo: "manual",
          matchScore: 100,
          devolucao: entrada.devolucao,
          compradorId: entrada.compradorId,
          compradorNome: entrada.compradorId ? (compradorNomeMap.get(entrada.compradorId) ?? null) : null,
          quantidade: quantidadeFinal,
          quantidadeOriginal,
          justificativaQuantidade: justificativa,
          updatedAt: new Date(),
        })
        .where(eq(itensNota.id, item.id))
      vinculados++

      // Equivalência aprendida (fornecedor + código do fornecedor -> produto).
      // O EAN e o código interno definem o produto; o fornecedor/código ajudam o
      // reconhecimento automático em notas futuras.
      if (item.codigoFornecedor) {
        const [equiv] = await db
          .select()
          .from(equivalenciaProdutos)
          .where(
            and(
              nota.fornecedorCnpj
                ? eq(equivalenciaProdutos.fornecedorCnpj, nota.fornecedorCnpj)
                : sql`${equivalenciaProdutos.fornecedorCnpj} is null`,
              eq(equivalenciaProdutos.codigoFornecedor, item.codigoFornecedor),
            ),
          )
          .limit(1)

        if (equiv) {
          await db
            .update(equivalenciaProdutos)
            .set({
              produtoId: produto.id,
              fornecedorId: nota.fornecedorId ?? equiv.fornecedorId,
              ean: clean(item.ean) ?? equiv.ean,
              descricaoFornecedor: clean(item.descricaoFornecedor) ?? equiv.descricaoFornecedor,
              vezesUsado: (equiv.vezesUsado ?? 1) + 1,
              updatedAt: new Date(),
            })
            .where(eq(equivalenciaProdutos.id, equiv.id))
        } else {
          await db.insert(equivalenciaProdutos).values({
            produtoId: produto.id,
            fornecedorId: nota.fornecedorId,
            fornecedorCnpj: clean(nota.fornecedorCnpj),
            codigoFornecedor: clean(item.codigoFornecedor),
            descricaoFornecedor: clean(item.descricaoFornecedor),
            ean: clean(item.ean),
            vezesUsado: 1,
            createdBy: actor.id,
          })
        }
      }

      // Histórico de aprendizado.
      await db.insert(historicoAprendizado).values({
        itemNotaId: item.id,
        produtoId: produto.id,
        descricaoFornecedor: clean(item.descricaoFornecedor),
        codigoFornecedor: clean(item.codigoFornecedor),
        ean: clean(item.ean),
        acao: "vinculado",
        score: 100,
        usuarioId: actor.id,
      })
    }

    revalidatePath("/importar")
    revalidatePath("/conferencia")
    revalidatePath("/produtos")
    revalidatePath("/equivalencias")

    return { ok: true, criados, vinculados }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar vinculações." }
  }
}
