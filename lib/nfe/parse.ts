// Parser de XML de NF-e. Portado 1:1 do backend original (services/xml_parser.py),
// usando fast-xml-parser. Suporta XML com e sem prefixo de namespace.

import { XMLParser } from "fast-xml-parser"

export type NfeHeader = {
  chave: string
  numero: string | null
  serie: string | null
  dataEmissao: string | null
  fornecedorCnpj: string | null
  fornecedorNome: string | null
  valorTotal: number
}

export type NfeItem = {
  numeroItem: number
  cprod: string
  ean: string | null
  descricaoNfe: string
  ncm: string | null
  cfop: string | null
  quantidade: number
  unidade: string
  valorUnitario: number
  valorTotal: number
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true, // trata "nfe:det" e "det" de forma uniforme
  parseTagValue: false, // mantém strings; convertemos números manualmente
  trimValues: true,
})

function txt(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === "object") {
    const inner = (v as Record<string, unknown>)["#text"]
    return inner === undefined || inner === null ? null : String(inner)
  }
  return String(v)
}

function num(v: unknown): number {
  const t = txt(v)
  const n = t ? Number.parseFloat(t) : 0
  return Number.isFinite(n) ? n : 0
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

export function parseNfeXml(xmlContent: string): { header: NfeHeader; items: NfeItem[] } {
  const doc = parser.parse(xmlContent) as Record<string, any>

  // Localiza infNFe percorrendo nfeProc/NFe/infNFe (com ou sem envelope).
  const infNFe =
    doc?.nfeProc?.NFe?.infNFe ??
    doc?.NFe?.infNFe ??
    doc?.nfeProc?.infNFe ??
    findDeep(doc, "infNFe")

  if (!infNFe) {
    throw new Error("XML inválido: elemento infNFe não encontrado.")
  }

  const ide = infNFe.ide ?? {}
  const emit = infNFe.emit ?? {}
  const icmsTot = infNFe.total?.ICMSTot ?? {}
  const idAttr = String(infNFe["@_Id"] ?? "")
  const chave = idAttr.replace(/^NFe/, "")

  const header: NfeHeader = {
    chave,
    numero: txt(ide.nNF),
    serie: txt(ide.serie),
    dataEmissao: txt(ide.dhEmi) ?? txt(ide.dEmi),
    fornecedorCnpj: txt(emit.CNPJ),
    fornecedorNome: txt(emit.xNome),
    valorTotal: num(icmsTot.vNF),
  }

  const items: NfeItem[] = []
  for (const det of asArray<any>(infNFe.det)) {
    const prod = det?.prod
    if (!prod) continue

    let eanRaw = txt(prod.cEAN) ?? ""
    if (eanRaw === "SEM GTIN" || eanRaw === "" || eanRaw === "None") {
      eanRaw = txt(prod.cEANTrib) ?? ""
    }
    const ean = eanRaw === "SEM GTIN" || eanRaw === "" ? null : eanRaw

    items.push({
      numeroItem: Number.parseInt(String(det["@_nItem"] ?? "0"), 10) || 0,
      cprod: txt(prod.cProd) ?? "",
      ean,
      descricaoNfe: txt(prod.xProd) ?? "",
      ncm: txt(prod.NCM),
      cfop: txt(prod.CFOP),
      quantidade: num(prod.qCom),
      unidade: txt(prod.uCom) ?? "UN",
      valorUnitario: num(prod.vUnCom),
      valorTotal: num(prod.vProd),
    })
  }

  return { header, items }
}

/** Busca recursiva por uma chave em objetos aninhados (fallback). */
function findDeep(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return undefined
  if (key in obj) return obj[key]
  for (const k of Object.keys(obj)) {
    const found = findDeep(obj[k], key)
    if (found !== undefined) return found
  }
  return undefined
}
