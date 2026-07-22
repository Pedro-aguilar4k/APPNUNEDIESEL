// Motor de matching de itens de NF-e para produtos internos.
// Os candidatos por similaridade são pré-filtrados com pg_trgm no Postgres (Neon)
// em vez de carregar todos os produtos em memória; os scores finais são calculados
// em JS com as fórmulas de normalize.ts.

import { db } from "@/lib/db"
import { produtos, equivalenciaProdutos, notas, itensNota } from "@/lib/db/schema"
import { and, eq, or, sql } from "drizzle-orm"
import {
  normalizeText,
  calculateSimilarity,
  extractManufacturerCode,
} from "@/lib/matching/normalize"

export type MatchCriterio = { criterio: string; peso: number; bonus?: boolean }

export type MatchProduto = {
  id: number
  codigo: string
  descricao: string
  ean?: string | null
}

export type MatchSugestao = {
  produto: MatchProduto
  similaridade: number
  criterios: MatchCriterio[]
}

export type MatchResult = {
  produto: MatchProduto | null
  metodo: "ean" | "vinculo" | "vinculo_aprendido" | "similaridade" | "sugestao" | "nenhum"
  confianca: number
  sugestoes: MatchSugestao[]
  criterios: MatchCriterio[]
}

export type MatchInput = {
  descricao: string
  ean?: string | null
  cprod?: string | null
  fornecedorCnpj?: string | null
  quantidade?: number
}

/** Cache por lote (uma NF-e) para evitar recomputar dados por item. */
export type MatchCache = {
  bindingCodes?: Set<string>
  supplierNotaCount?: number
}

const EAN_INVALIDOS = new Set(["SEM GTIN", "", "None", "0"])

function toProduto(row: {
  id: number
  codigoInterno: string
  descricao: string
  codigoBarras: string | null
}): MatchProduto {
  return { id: row.id, codigo: row.codigoInterno, descricao: row.descricao, ean: row.codigoBarras }
}

export async function matchProduct(input: MatchInput, cache?: MatchCache): Promise<MatchResult> {
  const { descricao, ean, cprod, fornecedorCnpj } = input
  const quantidade = input.quantidade ?? 0

  // 1) EAN idêntico -> confiança 100.
  if (ean && !EAN_INVALIDOS.has(ean)) {
    const [prod] = await db
      .select()
      .from(produtos)
      .where(and(eq(produtos.codigoBarras, ean), eq(produtos.ativo, true)))
      .limit(1)
    if (prod) {
      return {
        produto: toProduto(prod),
        metodo: "ean",
        confianca: 100,
        sugestoes: [],
        criterios: [{ criterio: "EAN Idêntico", peso: 100 }],
      }
    }
  }

  // 2) Vínculo aprendido (fornecedor + código do fornecedor) -> 95..99 conforme uso.
  if (fornecedorCnpj && cprod) {
    const [binding] = await db
      .select()
      .from(equivalenciaProdutos)
      .where(
        and(
          eq(equivalenciaProdutos.fornecedorCnpj, fornecedorCnpj),
          eq(equivalenciaProdutos.codigoFornecedor, cprod),
        ),
      )
      .limit(1)
    if (binding) {
      const [prod] = await db
        .select()
        .from(produtos)
        .where(and(eq(produtos.id, binding.produtoId), eq(produtos.ativo, true)))
        .limit(1)
      if (prod) {
        const usage = binding.vezesUsado ?? 0
        let score = 95
        if (usage >= 10) score = 99
        else if (usage >= 5) score = 98
        else if (usage >= 2) score = 97
        else if (usage >= 1) score = 96
        // Reforça o uso do vínculo.
        await db
          .update(equivalenciaProdutos)
          .set({ vezesUsado: usage + 1, updatedAt: new Date() })
          .where(eq(equivalenciaProdutos.id, binding.id))
        return {
          produto: toProduto(prod),
          metodo: "vinculo",
          confianca: score,
          sugestoes: [],
          criterios: [{ criterio: "Vínculo Fornecedor+Código", peso: score }],
        }
      }
    }
  }

  // 3) Similaridade textual + código de fabricante, com bônus.
  const normalizedDesc = normalizeText(descricao)
  const mfgCode = extractManufacturerCode(descricao)

  // Dados de contexto (cacheados por lote).
  let bindingCodes = cache?.bindingCodes
  if (!bindingCodes) {
    bindingCodes = new Set<string>()
    if (fornecedorCnpj) {
      const rows = await db
        .select({ produtoId: equivalenciaProdutos.produtoId })
        .from(equivalenciaProdutos)
        .where(eq(equivalenciaProdutos.fornecedorCnpj, fornecedorCnpj))
      for (const r of rows) bindingCodes.add(String(r.produtoId))
    }
    if (cache) cache.bindingCodes = bindingCodes
  }

  let supplierNotaCount = cache?.supplierNotaCount
  if (supplierNotaCount === undefined) {
    supplierNotaCount = 0
    if (fornecedorCnpj) {
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(notas)
        .where(eq(notas.fornecedorCnpj, fornecedorCnpj))
      supplierNotaCount = Number(c)
    }
    if (cache) cache.supplierNotaCount = supplierNotaCount
  }

  // Códigos com quantidade similar (bônus). Depende do item (não cacheável por lote).
  const similarQtyCodes = new Set<number>()
  if (quantidade > 0 && cprod) {
    const qMin = quantidade * 0.8
    const qMax = quantidade * 1.2
    const rows = await db
      .select({ produtoId: itensNota.produtoId })
      .from(itensNota)
      .where(
        and(
          eq(itensNota.codigoFornecedor, cprod),
          sql`${itensNota.produtoId} is not null`,
          sql`${itensNota.quantidade} >= ${qMin}`,
          sql`${itensNota.quantidade} <= ${qMax}`,
        ),
      )
    for (const r of rows) if (r.produtoId != null) similarQtyCodes.add(r.produtoId)
  }

  // Candidatos: pré-filtra por trigram (pg_trgm) na descrição bruta. Se a descrição
  // normalizada for muito curta, cai para um conjunto amplo de produtos ativos.
  const candidatePool = await loadCandidates(descricao, normalizedDesc, mfgCode)

  const suggestions: MatchSugestao[] = []
  for (const prod of candidatePool) {
    let bestScore = 0
    const criterios: MatchCriterio[] = []

    if (mfgCode) {
      const prodMfg = extractManufacturerCode(prod.descricao)
      if (prodMfg && prodMfg === mfgCode) {
        bestScore = 90
        criterios.push({ criterio: "Código Fabricante", peso: 90 })
      }
    }

    const sim = calculateSimilarity(normalizedDesc, normalizeText(prod.descricao))
    if (sim > bestScore) bestScore = sim
    if (sim >= 30) criterios.push({ criterio: "Similaridade", peso: Math.round(sim * 10) / 10 })

    if (bindingCodes.has(String(prod.id))) {
      bestScore += 5
      criterios.push({ criterio: "Vínculo Anterior", peso: 5, bonus: true })
    }
    if (supplierNotaCount >= 3) {
      bestScore += 3
      criterios.push({ criterio: "Fornecedor Recorrente", peso: 3, bonus: true })
    }
    if (similarQtyCodes.has(prod.id)) {
      bestScore += 2
      criterios.push({ criterio: "Quantidade Similar", peso: 2, bonus: true })
    }

    bestScore = Math.min(bestScore, 99)

    if (bestScore >= 40) {
      suggestions.push({
        produto: toProduto(prod),
        similaridade: Math.round(bestScore * 10) / 10,
        criterios,
      })
    }
  }

  suggestions.sort((a, b) => b.similaridade - a.similaridade)
  const top = suggestions.slice(0, 5)

  if (top.length && top[0].similaridade >= 95) {
    return {
      produto: top[0].produto,
      metodo: "vinculo_aprendido",
      confianca: top[0].similaridade,
      sugestoes: top,
      criterios: top[0].criterios,
    }
  }
  if (top.length && top[0].similaridade >= 90) {
    return {
      produto: top[0].produto,
      metodo: "similaridade",
      confianca: top[0].similaridade,
      sugestoes: top,
      criterios: top[0].criterios,
    }
  }
  if (top.length) {
    return { produto: null, metodo: "sugestao", confianca: top[0].similaridade, sugestoes: top, criterios: [] }
  }
  return { produto: null, metodo: "nenhum", confianca: 0, sugestoes: [], criterios: [] }
}

type CandidateRow = {
  id: number
  codigoInterno: string
  descricao: string
  codigoBarras: string | null
}

/**
 * Carrega os produtos candidatos. Usa pg_trgm (operador de similaridade) para reduzir
 * o universo de produtos, com um teto de 300 candidatos ordenados por similaridade.
 * Se a busca por trigram não retornar nada (descrições muito diferentes), amplia
 * para os produtos que compartilham ao menos um token relevante.
 */
async function loadCandidates(
  descricaoRaw: string,
  normalizedDesc: string,
  mfgCode: string | null,
): Promise<CandidateRow[]> {
  const query = normalizedDesc || descricaoRaw
  const rows = await db
    .select({
      id: produtos.id,
      codigoInterno: produtos.codigoInterno,
      descricao: produtos.descricao,
      codigoBarras: produtos.codigoBarras,
    })
    .from(produtos)
    .where(
      and(
        eq(produtos.ativo, true),
        or(
          sql`similarity(unaccent(upper(${produtos.descricao})), unaccent(upper(${query}))) > 0.1`,
          mfgCode ? sql`upper(${produtos.descricao}) like ${"%" + mfgCode + "%"}` : sql`false`,
          mfgCode ? eq(produtos.codigoFabricante, mfgCode) : sql`false`,
        ),
      ),
    )
    .orderBy(sql`similarity(unaccent(upper(${produtos.descricao})), unaccent(upper(${query}))) desc`)
    .limit(300)

  return rows
}
