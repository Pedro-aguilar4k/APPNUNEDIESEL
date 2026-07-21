import type { esperaItens } from "@/lib/db/schema"

export type EsperaItem = typeof esperaItens.$inferSelect

export const ESPERA_TIPOS = ["unidade", "pacote", "caixa"] as const
export type EsperaTipo = (typeof ESPERA_TIPOS)[number]

export const ESPERA_TIPO_LABELS: Record<EsperaTipo, string> = {
  unidade: "Unidade",
  pacote: "Pacote",
  caixa: "Caixa",
}

// Plural para exibicao ("2 caixas", "3 pacotes").
export const ESPERA_TIPO_PLURAL: Record<EsperaTipo, string> = {
  unidade: "unidades",
  pacote: "pacotes",
  caixa: "caixas",
}

export function isEsperaTipo(v: string): v is EsperaTipo {
  return (ESPERA_TIPOS as readonly string[]).includes(v)
}

/** Entrada para adicionar saldo à espera (novo item ou reforço de um existente). */
export type AdicionarEsperaInput = {
  codigoInterno: string
  boxPrimario: string
  boxSecundario?: string
  tipo: EsperaTipo
  // Para pacote/caixa: quantas unidades cabem em cada embalagem.
  unidadesPorEmbalagem?: number
  // Quantidade sendo adicionada, na unidade escolhida em `tipo`.
  // Ex.: tipo=caixa, quantidade=2 => adiciona 2 * unidadesPorEmbalagem unidades.
  quantidade: number
}

export type EsperaResult = { ok: true; codigo: string } | { ok: false; error: string }

/**
 * Traduz o saldo (fonte da verdade em unidades) para a forma de exibicao.
 * O total em unidades e sempre exato. Para pacote/caixa, calculamos quantas
 * embalagens sao necessarias para acomodar o saldo (ceil): se a caixa tem 15
 * e sobram 14 unidades, ainda e "1 caixa" (parcial). Uma caixa cheia consumida
 * simplesmente some do total.
 */
export function resumoEmbalagem(item: {
  tipo: string
  unidadesPorEmbalagem: number
  totalUnidades: number
}): {
  totalUnidades: number
  // Numero de embalagens necessarias (0 quando total = 0)
  embalagens: number
  // Unidades soltas na ultima embalagem (parcial)
  soltasNaUltima: number
  // true quando a ultima embalagem esta incompleta
  ultimaParcial: boolean
} {
  const upe = Math.max(1, item.unidadesPorEmbalagem || 1)
  const total = Math.max(0, item.totalUnidades || 0)

  if (item.tipo === "unidade" || upe === 1) {
    return { totalUnidades: total, embalagens: total, soltasNaUltima: total ? 1 : 0, ultimaParcial: false }
  }

  const embalagens = Math.ceil(total / upe)
  const resto = total % upe
  const soltasNaUltima = resto === 0 ? (total ? upe : 0) : resto
  return {
    totalUnidades: total,
    embalagens,
    soltasNaUltima,
    ultimaParcial: resto !== 0,
  }
}

/** Texto curto de saldo: ex. "30 un · 2 caixas" ou "14 un · 1 caixa (parcial)". */
export function saldoTexto(item: { tipo: string; unidadesPorEmbalagem: number; totalUnidades: number }): string {
  const r = resumoEmbalagem(item)
  const un = `${r.totalUnidades} un`
  if (item.tipo === "unidade" || item.unidadesPorEmbalagem <= 1) return un
  const tipo = item.tipo as EsperaTipo
  const nome = r.embalagens === 1 ? ESPERA_TIPO_LABELS[tipo].toLowerCase() : ESPERA_TIPO_PLURAL[tipo]
  const parcial = r.ultimaParcial ? " (parcial)" : ""
  return `${un} · ${r.embalagens} ${nome}${parcial}`
}
