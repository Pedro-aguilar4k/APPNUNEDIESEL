"use server"

import { db } from "@/lib/db"
import { notas, itensNota, produtos, relatoriosConferencia } from "@/lib/db/schema"
import { eq, desc, and, ilike } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"

function qty(v: string | null | undefined): number {
  return v ? Number(v) : 0
}

function pad(value: string, width: number): string {
  const v = value ?? ""
  if (v.length >= width) return v.slice(0, width)
  return v + " ".repeat(width - v.length)
}

function padLeft(value: string, width: number): string {
  const v = value ?? ""
  if (v.length >= width) return v.slice(0, width)
  return " ".repeat(width - v.length) + v
}

const LINE = "=".repeat(78)
const THIN = "-".repeat(78)

/**
 * Monta o conteúdo textual (fonte de verdade) do relatório de conferência.
 * Layout de largura fixa (78 colunas) para reimpressão consistente em PDF.
 */
function buildRelatorioTxt(params: {
  nota: typeof notas.$inferSelect
  itens: { item: typeof itensNota.$inferSelect; produtoCodigo: string | null; produtoDescricao: string | null }[]
  estoquista: string
  conferentePor: string
  geradoEm: Date
}): { txt: string; totalItens: number; conferidos: number; divergentes: number; status: string } {
  const { nota, itens, estoquista, conferentePor, geradoEm } = params

  let conferidos = 0
  let divergentes = 0
  for (const { item } of itens) {
    const q = qty(item.quantidade)
    const qc = qty(item.quantidadeConferida)
    if (qc >= q && q > 0) conferidos++
    else divergentes++
  }
  const status = divergentes === 0 ? "conferida" : "divergente"

  const dt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-"

  const linhas: string[] = []
  linhas.push(LINE)
  linhas.push(pad("NUNEDIESEL - AUTOPECAS - LINHA PESADA", 78))
  linhas.push(pad("RELATORIO DE CONFERENCIA DE MERCADORIA", 78))
  linhas.push(LINE)
  linhas.push("")
  linhas.push(`Nota Fiscal.....: ${nota.numero ?? "-"}${nota.serie ? "  Serie: " + nota.serie : ""}`)
  linhas.push(`Fornecedor......: ${nota.fornecedorNome ?? "-"}`)
  if (nota.fornecedorCnpj) linhas.push(`CNPJ............: ${nota.fornecedorCnpj}`)
  linhas.push(`Emissao.........: ${dt(nota.dataEmissao)}`)
  linhas.push(`Chave de acesso.: ${nota.chaveAcesso ?? "-"}`)
  linhas.push("")
  linhas.push(`Estoquista......: ${estoquista}`)
  linhas.push(`Conferido por...: ${conferentePor}`)
  linhas.push(`Gerado em.......: ${dt(geradoEm)}`)
  linhas.push(`Status..........: ${status === "conferida" ? "CONFERIDA (SEM DIVERGENCIAS)" : "DIVERGENTE"}`)
  linhas.push("")
  linhas.push(THIN)
  linhas.push(pad("COD", 8) + pad("DESCRICAO", 40) + padLeft("NF", 6) + padLeft("CONF", 7) + padLeft("SIT", 9))
  linhas.push(THIN)

  for (const { item, produtoCodigo, produtoDescricao } of itens) {
    const q = qty(item.quantidade)
    const qc = qty(item.quantidadeConferida)
    const ok = qc >= q && q > 0
    const cod = produtoCodigo ?? item.codigoFornecedor ?? "-"
    const desc = produtoDescricao ?? item.descricaoFornecedor ?? "-"
    linhas.push(
      pad(cod, 8) +
        pad(desc, 40) +
        padLeft(String(q), 6) +
        padLeft(String(qc), 7) +
        padLeft(ok ? "OK" : "DIVERG.", 9),
    )
    // Diferença detalhada quando diverge.
    if (!ok) {
      const dif = qc - q
      linhas.push(pad("", 8) + pad(`  >> diferenca: ${dif > 0 ? "+" : ""}${dif}`, 40))
    }
  }

  linhas.push(THIN)
  linhas.push("")
  linhas.push(`Total de itens..........: ${itens.length}`)
  linhas.push(`Itens conferidos OK.....: ${conferidos}`)
  linhas.push(`Itens divergentes.......: ${divergentes}`)
  linhas.push("")
  linhas.push(LINE)
  linhas.push(pad("Assinatura do estoquista: ______________________________________", 78))
  linhas.push("")
  linhas.push(pad("Assinatura do conferente: ______________________________________", 78))
  linhas.push(LINE)

  return { txt: linhas.join("\n"), totalItens: itens.length, conferidos, divergentes, status }
}

// Dados estruturados salvos junto ao relatório para renderizar o PDF.
export type RelatorioItemDados = {
  codigoOriginal: string
  codigoInterno: string
  ean: string
  descricao: string
  quantidade: number
  quantidadeConferida: number
  unidade: string
  ok: boolean
}

export type RelatorioDados = {
  empresa: string
  nota: { numero: string; serie: string; fornecedor: string; cnpj: string; emissao: string; chave: string }
  estoquista: string
  conferentePor: string
  geradoEm: string
  status: "conferida" | "divergente"
  totais: { total: number; conferidos: number; divergentes: number }
  itens: RelatorioItemDados[]
}

export type RelatorioResumo = {
  id: number
  notaId: number
  numeroNota: string | null
  fornecedorNome: string | null
  estoquista: string
  status: string
  totalItens: number
  itensConferidos: number
  itensDivergentes: number
  createdByNome: string | null
  createdAt: Date
}

/** Gera e salva o relatório de conferência (TXT) para a nota. */
export async function gerarRelatorioConferencia(input: {
  notaId: number
  estoquista: string
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const actor = await requirePermission("conferir")
  const nome = input.estoquista.trim()
  if (!nome) return { ok: false, error: "Informe o nome do estoquista." }

  const [nota] = await db.select().from(notas).where(eq(notas.id, input.notaId)).limit(1)
  if (!nota) return { ok: false, error: "Nota não encontrada." }

  const itens = await db
    .select({
      item: itensNota,
      produtoCodigo: produtos.codigoInterno,
      produtoDescricao: produtos.descricao,
    })
    .from(itensNota)
    .leftJoin(produtos, eq(produtos.id, itensNota.produtoId))
    .where(eq(itensNota.notaId, input.notaId))
    .orderBy(itensNota.id)

  const geradoEm = new Date()
  const built = buildRelatorioTxt({
    nota,
    itens,
    estoquista: nome,
    conferentePor: actor.name,
    geradoEm,
  })

  const dtBR = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-"

  const dados: RelatorioDados = {
    empresa: "NUNEDIESEL · Autopeças Linha Pesada",
    nota: {
      numero: nota.numero ?? "-",
      serie: nota.serie ?? "",
      fornecedor: nota.fornecedorNome ?? "-",
      cnpj: nota.fornecedorCnpj ?? "",
      emissao: dtBR(nota.dataEmissao),
      chave: nota.chaveAcesso ?? "",
    },
    estoquista: nome,
    conferentePor: actor.name,
    geradoEm: dtBR(geradoEm),
    status: built.status as "conferida" | "divergente",
    totais: { total: built.totalItens, conferidos: built.conferidos, divergentes: built.divergentes },
    itens: itens.map(({ item, produtoCodigo, produtoDescricao }) => {
      const q = qty(item.quantidade)
      const qc = qty(item.quantidadeConferida)
      return {
        codigoOriginal: item.codigoFornecedor ?? "-",
        codigoInterno: produtoCodigo ?? "-",
        ean: item.ean ?? "-",
        descricao: produtoDescricao ?? item.descricaoFornecedor ?? "-",
        quantidade: q,
        quantidadeConferida: qc,
        unidade: item.unidade ?? "",
        ok: qc >= q && q > 0,
      }
    }),
  }

  const [row] = await db
    .insert(relatoriosConferencia)
    .values({
      notaId: nota.id,
      numeroNota: nota.numero,
      fornecedorNome: nota.fornecedorNome,
      estoquista: nome,
      status: built.status,
      totalItens: built.totalItens,
      itensConferidos: built.conferidos,
      itensDivergentes: built.divergentes,
      conteudoTxt: built.txt,
      dadosJson: dados,
      createdBy: actor.id,
      createdByNome: actor.name,
      createdAt: geradoEm,
    })
    .returning({ id: relatoriosConferencia.id })

  return { ok: true, id: row.id }
}

/** Lista todos os relatórios gerados, com filtro opcional por número da nota. */
export async function listTodosRelatorios(input?: { numero?: string }): Promise<RelatorioResumo[]> {
  await requirePermission("relatorios")
  const conds = []
  if (input?.numero?.trim()) conds.push(ilike(relatoriosConferencia.numeroNota, `%${input.numero.trim()}%`))
  const rows = await db
    .select({
      id: relatoriosConferencia.id,
      notaId: relatoriosConferencia.notaId,
      numeroNota: relatoriosConferencia.numeroNota,
      fornecedorNome: relatoriosConferencia.fornecedorNome,
      estoquista: relatoriosConferencia.estoquista,
      status: relatoriosConferencia.status,
      totalItens: relatoriosConferencia.totalItens,
      itensConferidos: relatoriosConferencia.itensConferidos,
      itensDivergentes: relatoriosConferencia.itensDivergentes,
      createdByNome: relatoriosConferencia.createdByNome,
      createdAt: relatoriosConferencia.createdAt,
    })
    .from(relatoriosConferencia)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(relatoriosConferencia.createdAt))
    .limit(200)
  return rows
}

/** Lista os relatórios já gerados para uma nota. */
export async function listRelatoriosNota(notaId: number): Promise<RelatorioResumo[]> {
  await requirePermission("conferir")
  const rows = await db
    .select({
      id: relatoriosConferencia.id,
      notaId: relatoriosConferencia.notaId,
      numeroNota: relatoriosConferencia.numeroNota,
      fornecedorNome: relatoriosConferencia.fornecedorNome,
      estoquista: relatoriosConferencia.estoquista,
      status: relatoriosConferencia.status,
      totalItens: relatoriosConferencia.totalItens,
      itensConferidos: relatoriosConferencia.itensConferidos,
      itensDivergentes: relatoriosConferencia.itensDivergentes,
      createdByNome: relatoriosConferencia.createdByNome,
      createdAt: relatoriosConferencia.createdAt,
    })
    .from(relatoriosConferencia)
    .where(eq(relatoriosConferencia.notaId, notaId))
    .orderBy(desc(relatoriosConferencia.createdAt))
  return rows
}
