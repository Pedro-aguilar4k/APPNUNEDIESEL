// Normalização e similaridade de texto para o matching de produtos de autopeças.

export const ABBREVIATIONS: Record<string, string> = {
  "AMORT.": "AMORTECEDOR", AMORT: "AMORTECEDOR",
  DT: "DIANTEIRO", "DIANT.": "DIANTEIRO", DIANT: "DIANTEIRO",
  TR: "TRASEIRO", "TRAS.": "TRASEIRO", TRAS: "TRASEIRO",
  "ESQ.": "ESQUERDO", ESQ: "ESQUERDO",
  "DIR.": "DIREITO", DIR: "DIREITO",
  "SUP.": "SUPERIOR", SUP: "SUPERIOR",
  "INF.": "INFERIOR", INF: "INFERIOR",
  "PAST.": "PASTILHA", PAST: "PASTILHA",
  "FILT.": "FILTRO", FILT: "FILTRO",
  "CJ.": "CONJUNTO", CJ: "CONJUNTO",
  "CX.": "CAIXA", CX: "CAIXA",
  "UN.": "UNIDADE", UN: "UNIDADE",
  "JG.": "JOGO", JG: "JOGO",
  "PC.": "PECA", PC: "PECA",
  "CPL.": "COMPLETO", CPL: "COMPLETO",
  "COMPR.": "COMPRIMENTO", COMPR: "COMPRIMENTO",
  "CIL.": "CILINDRICO", CIL: "CILINDRICO",
  "COMB.": "COMBUSTIVEL", COMB: "COMBUSTIVEL",
  "DISTR.": "DISTRIBUICAO", DISTR: "DISTRIBUICAO",
  "TRANSF.": "TRANSFERENCIA", TRANSF: "TRANSFERENCIA",
  "REP.": "REPARO", REP: "REPARO",
  "RET.": "RETENTOR", RET: "RETENTOR",
  "ROL.": "ROLAMENTO", ROL: "ROLAMENTO",
  "EMBRG.": "EMBREAGEM", EMBRG: "EMBREAGEM",
  CAMBIO: "CAMBIO",
  "RAD.": "RADIADOR", RAD: "RADIADOR",
  "TANQ.": "TANQUE", TANQ: "TANQUE",
  "FECH.": "FECHADURA", FECH: "FECHADURA",
  "CONEX.": "CONEXAO", CONEX: "CONEXAO",
  "REDUT.": "REDUTORA", REDUT: "REDUTORA",
  "MANG.": "MANGUEIRA", MANG: "MANGUEIRA",
  "RESERV.": "RESERVATORIO", RESERV: "RESERVATORIO",
  "ESTIC.": "ESTICADOR", ESTIC: "ESTICADOR",
  LTS: "LITROS",
  "PLAST.": "PLASTICO", PLAST: "PLASTICO",
}

export const STOP_WORDS = new Set([
  "DE", "DO", "DA", "DOS", "DAS", "O", "A", "OS", "AS",
  "UM", "UMA", "E", "OU", "COM", "SEM", "PARA", "POR",
  "NO", "NA", "NOS", "NAS", "AO", "AOS", "EM",
])

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Remove código de fabricante no início da descrição ("COBREQ N-1234 - PASTILHA..." -> "PASTILHA..."). */
export function stripManufacturerCode(text: string): string {
  if (!text) return text
  const match = text.trim().match(/^[A-Za-z0-9][A-Za-z0-9\s./]{2,30}?\s*-\s+(.+)$/)
  if (match) return match[1].trim()
  return text
}

/** Normaliza texto: remove acentos, maiúsculas, expande abreviações e remove stop words. */
export function normalizeText(text: string): string {
  if (!text) return ""
  let t = stripManufacturerCode(text)
  t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  t = t.toUpperCase().trim()
  const abbrs = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length)
  for (const abbr of abbrs) {
    t = t.replace(new RegExp(`\\b${escapeRegExp(abbr)}\\b`, "g"), ABBREVIATIONS[abbr])
  }
  t = t.replace(/[^A-Z0-9\s]/g, " ")
  const words = t.split(/\s+/).filter((w) => w && !STOP_WORDS.has(w) && w.length > 1)
  return words.join(" ")
}

/**
 * Implementa o algoritmo Ratcliff-Obershelp (equivalente ao SequenceMatcher.ratio()).
 */
function matchingBlocksLength(a: string, b: string): number {
  if (!a.length || !b.length) return 0
  // Encontra o maior bloco em comum.
  let bestI = 0
  let bestJ = 0
  let bestSize = 0
  const b2j = new Map<string, number[]>()
  for (let j = 0; j < b.length; j++) {
    const arr = b2j.get(b[j])
    if (arr) arr.push(j)
    else b2j.set(b[j], [j])
  }
  let j2len = new Map<number, number>()
  for (let i = 0; i < a.length; i++) {
    const newj2len = new Map<number, number>()
    const indices = b2j.get(a[i])
    if (indices) {
      for (const j of indices) {
        const k = (j > 0 ? j2len.get(j - 1) ?? 0 : 0) + 1
        newj2len.set(j, k)
        if (k > bestSize) {
          bestI = i - k + 1
          bestJ = j - k + 1
          bestSize = k
        }
      }
    }
    j2len = newj2len
  }
  if (bestSize === 0) return 0
  // Recurse à esquerda e à direita do bloco encontrado.
  return (
    bestSize +
    matchingBlocksLength(a.slice(0, bestI), b.slice(0, bestJ)) +
    matchingBlocksLength(a.slice(bestI + bestSize), b.slice(bestJ + bestSize))
  )
}

function sequenceRatio(a: string, b: string): number {
  const total = a.length + b.length
  if (total === 0) return 1
  return (2 * matchingBlocksLength(a, b)) / total
}

  /** Similaridade combinada (40% sequência + 60% overlap de tokens), 0..100. */
export function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0
  const seqRatio = sequenceRatio(text1, text2) * 100
  const tokens1 = new Set(text1.split(/\s+/).filter(Boolean))
  const tokens2 = new Set(text2.split(/\s+/).filter(Boolean))
  if (tokens1.size === 0 || tokens2.size === 0) return seqRatio
  let overlap = 0
  for (const tk of tokens1) if (tokens2.has(tk)) overlap++
  const tokenRatio = (overlap / Math.max(tokens1.size, tokens2.size)) * 100
  return Math.round((seqRatio * 0.4 + tokenRatio * 0.6) * 10) / 10
}

/** Extrai o código de fabricante do início da descrição, se houver (>=4 chars). */
export function extractManufacturerCode(text: string): string | null {
  if (!text) return null
  const match = text.trim().match(/^([A-Za-z0-9][A-Za-z0-9\s./]{2,30}?)\s*-\s+/)
  if (match) {
    const codeClean = match[1].trim().toUpperCase().replace(/[\s.\-/]/g, "")
    if (codeClean.length >= 4) return codeClean
  }
  return null
}
