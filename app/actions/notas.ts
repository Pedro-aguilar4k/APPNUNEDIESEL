"use server"

import { db } from "@/lib/db"
import { notas, itensNota, fornecedores, user } from "@/lib/db/schema"
import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { requirePermission, requireActor } from "@/lib/guards"
import { registrarLog } from "@/lib/logs"
import { parseNfeXml } from "@/lib/nfe/parse"
import { matchProduct, type MatchCache } from "@/lib/matching/match"
import { revalidatePath } from "next/cache"

const metodoToTipo: Record<string, string> = {
  ean: "ean",
  vinculo: "equivalencia",
  vinculo_aprendido: "equivalencia",
  similaridade: "similaridade",
  sugestao: "sugestao",
  nenhum: "none",
}

export type ImportResult =
  | {
      ok: true
      notaId: number
      totalItens: number
      comMatch: number
      pendentes: number
      duplicada?: boolean
    }
  | { ok: false; error: string }

export async function importNfeXml(xmlContent: string): Promise<ImportResult> {
  const actor = await requirePermission("gerenciar_notas")

  let parsed: ReturnType<typeof parseNfeXml>
  try {
    parsed = parseNfeXml(xmlContent)
  } catch (e) {
    return { ok: false, error: "XML inválido ou não reconhecido como NF-e." }
  }

  const { header, items } = parsed
  if (!items.length) {
    return { ok: false, error: "Nenhum item encontrado na NF-e." }
  }

  // Evita reimportar a mesma nota (por chave de acesso).
  if (header.chave) {
    const existing = await db
      .select({ id: notas.id })
      .from(notas)
      .where(eq(notas.chaveAcesso, header.chave))
      .limit(1)
    if (existing.length) {
      return { ok: true, notaId: existing[0].id, totalItens: 0, comMatch: 0, pendentes: 0, duplicada: true }
    }
  }

  // Vincula/cria fornecedor pelo CNPJ.
  let fornecedorId: number | null = null
  if (header.fornecedorCnpj) {
    const found = await db
      .select({ id: fornecedores.id })
      .from(fornecedores)
      .where(eq(fornecedores.cnpj, header.fornecedorCnpj))
      .limit(1)
    if (found.length) {
      fornecedorId = found[0].id
    } else {
      const inserted = await db
        .insert(fornecedores)
        .values({
          cnpj: header.fornecedorCnpj,
          razaoSocial: header.fornecedorNome ?? "Fornecedor sem nome",
          createdBy: actor.id,
        })
        .returning({ id: fornecedores.id })
      fornecedorId = inserted[0].id
    }
  }

  const [nota] = await db
    .insert(notas)
    .values({
      chaveAcesso: header.chave || null,
      numero: header.numero,
      serie: header.serie,
      fornecedorId,
      fornecedorCnpj: header.fornecedorCnpj,
      fornecedorNome: header.fornecedorNome,
      dataEmissao: header.dataEmissao ? new Date(header.dataEmissao) : null,
      valorTotal: header.valorTotal ? String(header.valorTotal) : null,
      status: "pendente",
      origem: "xml",
      totalItens: items.length,
      createdBy: actor.id,
    })
    .returning({ id: notas.id })

  // Matching de cada item (cache por lote para evitar recomputar dados do fornecedor).
  const cache: MatchCache = {}
  let comMatch = 0

  for (const item of items) {
    const result = await matchProduct(
      {
        descricao: item.descricaoNfe,
        ean: item.ean,
        cprod: item.cprod,
        fornecedorCnpj: header.fornecedorCnpj,
        quantidade: item.quantidade,
      },
      cache,
    )

    const matched = result.produto !== null
    if (matched) comMatch++

    await db.insert(itensNota).values({
      notaId: nota.id,
      codigoFornecedor: item.cprod,
      descricaoFornecedor: item.descricaoNfe,
      ean: item.ean,
      ncm: item.ncm,
      quantidade: String(item.quantidade),
      unidade: item.unidade,
      valorUnitario: item.valorUnitario ? String(item.valorUnitario) : null,
      valorTotal: item.valorTotal ? String(item.valorTotal) : null,
      produtoId: result.produto?.id ?? null,
      matchTipo: metodoToTipo[result.metodo] ?? "none",
      matchScore: result.confianca,
      statusConferencia: "pendente",
    })
  }

  await registrarLog({
    actor,
    area: "importacao",
    acao: "importou",
    detalhe: `Importou a NF-e ${header.numero ?? "s/nº"}${
      header.fornecedorNome ? ` de ${header.fornecedorNome}` : ""
    } (${items.length} ${items.length === 1 ? "item" : "itens"}, ${comMatch} com vínculo).`,
  })

  revalidatePath("/importar")
  revalidatePath("/conferencia")
  return { ok: true, notaId: nota.id, totalItens: items.length, comMatch, pendentes: items.length - comMatch }
}

export type NotaListItem = {
  id: number
  numero: string | null
  fornecedorNome: string | null
  dataEmissao: Date | null
  valorTotal: string | null
  status: string
  origem: string
  totalItens: number | null
  itensConferidos: number | null
  itensPendentes: number
  importadoPor: string | null
  createdAt: Date
}

export async function listNotas(params?: { search?: string; status?: string }): Promise<NotaListItem[]> {
  await requirePermission("gerenciar_notas")
  const search = params?.search?.trim()
  const status = params?.status?.trim()

  const conditions = []
  if (search) {
    conditions.push(
      or(
        ilike(notas.numero, `%${search}%`),
        ilike(notas.fornecedorNome, `%${search}%`),
        ilike(notas.chaveAcesso, `%${search}%`),
      ),
    )
  }
  if (status && status !== "todos") {
    conditions.push(eq(notas.status, status))
  }

  // Notas conferidas/divergentes somem da aba de importação após 24h
  // (o histórico permanece disponível na aba de Relatórios).
  conditions.push(
    sql`NOT (${notas.status} IN ('conferida', 'divergente') AND ${notas.conferidaEm} IS NOT NULL AND ${notas.conferidaEm} < now() - interval '24 hours')`,
  )

  return db
    .select({
      id: notas.id,
      numero: notas.numero,
      fornecedorNome: notas.fornecedorNome,
      dataEmissao: notas.dataEmissao,
      valorTotal: notas.valorTotal,
      status: notas.status,
      origem: notas.origem,
      totalItens: notas.totalItens,
      itensConferidos: notas.itensConferidos,
      itensPendentes: sql<number>`(
        select count(*)::int from ${itensNota}
        where ${itensNota.notaId} = ${notas.id} and ${itensNota.produtoId} is null
      )`,
      importadoPor: sql<string | null>`(
        select ${user.name} from ${user} where ${user.id} = ${notas.createdBy}
      )`,
      createdAt: notas.createdAt,
    })
    .from(notas)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(notas.createdAt))
    .limit(100)
}

export async function getNota(id: number) {
  await requirePermission("gerenciar_notas")
  const [nota] = await db.select().from(notas).where(eq(notas.id, id)).limit(1)
  if (!nota) return null
  const itens = await db
    .select()
    .from(itensNota)
    .where(eq(itensNota.notaId, id))
    .orderBy(itensNota.id)
  return { nota, itens }
}

export async function deleteNota(id: number) {
  const actor = await requirePermission("gerenciar_notas")
  const [nota] = await db.select({ numero: notas.numero }).from(notas).where(eq(notas.id, id)).limit(1)
  await db.delete(itensNota).where(eq(itensNota.notaId, id))
  await db.delete(notas).where(eq(notas.id, id))
  await registrarLog({
    actor,
    area: "importacao",
    acao: "excluiu",
    detalhe: `Excluiu a NF-e ${nota?.numero ?? `#${id}`} e seus itens.`,
  })
  revalidatePath("/importar")
  return { ok: true }
}
