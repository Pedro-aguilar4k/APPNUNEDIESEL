"use server"

import { db } from "@/lib/db"
import { notas, itensNota, produtos, equivalenciaProdutos, historicoLeituras, historicoAprendizado, user } from "@/lib/db/schema"
import { and, eq, or, sql } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"
import { registrarLog } from "@/lib/logs"
import { revalidatePath } from "next/cache"

type ItemRow = typeof itensNota.$inferSelect

function qtyNum(v: string | null | undefined): number {
  return v ? Number(v) : 0
}

function gamePayload(item: ItemRow, produtoDescricao?: string | null, produtoCodigo?: string | null) {
  return {
    id: item.id,
    cprod: item.codigoFornecedor,
    ean: item.ean,
    descricaoNfe: item.descricaoFornecedor,
    produtoId: item.produtoId,
    produtoCodigo: produtoCodigo ?? null,
    produtoDescricao: produtoDescricao ?? null,
    quantidade: qtyNum(item.quantidade),
    quantidadeConferida: qtyNum(item.quantidadeConferida),
    unidade: item.unidade,
    ncm: item.ncm,
    statusConferencia: item.statusConferencia,
    devolucao: item.devolucao,
    compradorNome: item.compradorNome,
    quantidadeOriginal: item.quantidadeOriginal ? qtyNum(item.quantidadeOriginal) : null,
    justificativaQuantidade: item.justificativaQuantidade,
  }
}

async function notaProgress(notaId: number) {
  const rows = await db
    .select({ q: itensNota.quantidade, qc: itensNota.quantidadeConferida })
    .from(itensNota)
    .where(eq(itensNota.notaId, notaId))
  const totalItens = rows.length
  const itensCompletos = rows.filter((r) => qtyNum(r.q) > 0 && qtyNum(r.qc) >= qtyNum(r.q)).length
  return { itensCompletos, totalItens }
}

/** Detalhe completo da nota para a tela de conferência, com dados do produto vinculado. */
export async function getConferencia(notaId: number) {
  await requirePermission("conferir")
  const [nota] = await db.select().from(notas).where(eq(notas.id, notaId)).limit(1)
  if (!nota) return null

  // Nome de quem importou/criou a nota (para exibir na conferência).
  let importadoPor: string | null = null
  if (nota.createdBy) {
    const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, nota.createdBy)).limit(1)
    importadoPor = u?.name ?? null
  }

  const itens = await db
    .select({
      item: itensNota,
      produtoCodigo: produtos.codigoInterno,
      produtoDescricao: produtos.descricao,
    })
    .from(itensNota)
    .leftJoin(produtos, eq(produtos.id, itensNota.produtoId))
    .where(eq(itensNota.notaId, notaId))
    .orderBy(itensNota.id)

  const progress = await notaProgress(notaId)
  return {
    nota: { ...nota, importadoPor },
    itens: itens.map((r) => gamePayload(r.item, r.produtoDescricao, r.produtoCodigo)),
    progress,
  }
}

export async function iniciarConferencia(notaId: number) {
  await requirePermission("conferir")
  // Bloqueia início se houver itens sem produto vinculado.
  const pendentes = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(itensNota)
    .where(and(eq(itensNota.notaId, notaId), sql`${itensNota.produtoId} is null`))
  if ((pendentes[0]?.n ?? 0) > 0) {
    return { ok: false as const, error: `Existem ${pendentes[0].n} item(ns) sem vínculo. Complete a vinculação antes de iniciar.` }
  }
  await db
    .update(notas)
    .set({ status: "em_conferencia", updatedAt: new Date() })
    .where(eq(notas.id, notaId))
  revalidatePath(`/conferencia/${notaId}`)
  return { ok: true as const }
}

export type LeituraResult = {
  success: boolean
  tipo: "completo" | "parcial" | "nao_pertence" | "desconhecido" | "produto_errado" | "ja_conferido" | "duplicado_ignorado"
  message: string
  item: ReturnType<typeof gamePayload> | null
  scanned?: { codigo: string; descricao?: string | null } | null
  progress: { itensCompletos: number; totalItens: number }
  notaCompleta: boolean
}

export async function processarLeitura(input: {
  notaId: number
  codigoBarras: string
  itemAtivoId?: number | null
  scanUuid?: string | null
}): Promise<LeituraResult> {
  const actor = await requirePermission("conferir")
  const codigo = input.codigoBarras.trim()

  // Idempotência: bipagem já processada não conta de novo.
  if (input.scanUuid) {
    const [ja] = await db
      .select()
      .from(historicoLeituras)
      .where(and(eq(historicoLeituras.notaId, input.notaId), eq(historicoLeituras.scanUuid, input.scanUuid)))
      .limit(1)
    if (ja) {
      const progress = await notaProgress(input.notaId)
      let item = null
      if (ja.itemNotaId) {
        const [row] = await db
          .select({ item: itensNota, pc: produtos.codigoInterno, pd: produtos.descricao })
          .from(itensNota)
          .leftJoin(produtos, eq(produtos.id, itensNota.produtoId))
          .where(eq(itensNota.id, ja.itemNotaId))
          .limit(1)
        if (row) item = gamePayload(row.item, row.pd, row.pc)
      }
      return {
        success: ja.resultado === "encontrado",
        tipo: "duplicado_ignorado",
        message: "Leitura já registrada.",
        item,
        progress,
        notaCompleta: progress.itensCompletos >= progress.totalItens,
      }
    }
  }

  // Candidatos: itens da nota cujo EAN bate com o código bipado.
  const byEan = await db
    .select()
    .from(itensNota)
    .where(and(eq(itensNota.notaId, input.notaId), eq(itensNota.ean, codigo)))

  // Produto interno pelo código de barras / EAN / código interno.
  const [produto] = await db
    .select()
    .from(produtos)
    .where(
      and(
        eq(produtos.ativo, true),
        or(eq(produtos.codigoBarras, codigo), eq(produtos.codigoInterno, codigo)),
      ),
    )
    .limit(1)

  const candidates: ItemRow[] = [...byEan]
  if (produto) {
    const seen = new Set(candidates.map((c) => c.id))
    const more = await db
      .select()
      .from(itensNota)
      .where(and(eq(itensNota.notaId, input.notaId), eq(itensNota.produtoId, produto.id)))
    for (const m of more) if (!seen.has(m.id)) candidates.push(m)
  }

  let progress = await notaProgress(input.notaId)

  if (candidates.length === 0) {
    if (produto) {
      await db.insert(historicoLeituras).values({
        notaId: input.notaId,
        codigoLido: codigo,
        produtoId: produto.id,
        resultado: "nao_pertence",
        usuarioId: actor.id,
      })
      return {
        success: false,
        tipo: "nao_pertence",
        message: "Produto não pertence a esta NF-e.",
        scanned: { codigo: produto.codigoInterno, descricao: produto.descricao },
        item: null,
        progress,
        notaCompleta: false,
      }
    }
    await db.insert(historicoLeituras).values({
      notaId: input.notaId,
      codigoLido: codigo,
      resultado: "desconhecido",
      usuarioId: actor.id,
    })
    return {
      success: false,
      tipo: "desconhecido",
      message: "Código não encontrado nesta nota.",
      scanned: { codigo },
      item: null,
      progress,
      notaCompleta: false,
    }
  }

  // Resolve item alvo considerando o item ativo no visor.
  let itemDoc: ItemRow | undefined
  if (input.itemAtivoId) {
    itemDoc = candidates.find((c) => c.id === input.itemAtivoId)
    if (!itemDoc) {
      const [ativo] = await db.select().from(itensNota).where(eq(itensNota.id, input.itemAtivoId)).limit(1)
      if (ativo && qtyNum(ativo.quantidadeConferida) < qtyNum(ativo.quantidade)) {
        const scannedDoc = candidates[0]
        await db.insert(historicoLeituras).values({
          notaId: input.notaId,
          codigoLido: codigo,
          itemNotaId: scannedDoc.id,
          resultado: "produto_errado",
          usuarioId: actor.id,
        })
        return {
          success: false,
          tipo: "produto_errado",
          message: "Produto não é o indicado no visor!",
          scanned: { codigo, descricao: scannedDoc.descricaoFornecedor },
          item: gamePayload(ativo),
          progress,
          notaCompleta: false,
        }
      }
    }
  }

  if (!itemDoc) {
    const incomplete = candidates.filter((c) => qtyNum(c.quantidadeConferida) < qtyNum(c.quantidade))
    itemDoc = incomplete[0] ?? candidates[0]
  }

  if (qtyNum(itemDoc.quantidadeConferida) >= qtyNum(itemDoc.quantidade)) {
    await db.insert(historicoLeituras).values({
      notaId: input.notaId,
      codigoLido: codigo,
      itemNotaId: itemDoc.id,
      resultado: "ja_conferido",
      usuarioId: actor.id,
    })
    return {
      success: false,
      tipo: "ja_conferido",
      message: "Este item já foi conferido!",
      item: gamePayload(itemDoc),
      progress,
      notaCompleta: false,
    }
  }

  const newQty = qtyNum(itemDoc.quantidadeConferida) + 1
  const completed = newQty >= qtyNum(itemDoc.quantidade)
  await db
    .update(itensNota)
    .set({
      quantidadeConferida: String(newQty),
      statusConferencia: completed ? "conferido" : "em_contagem",
      updatedAt: new Date(),
    })
    .where(eq(itensNota.id, itemDoc.id))

  await db.insert(historicoLeituras).values({
    notaId: input.notaId,
    codigoLido: codigo,
    produtoId: itemDoc.produtoId,
    itemNotaId: itemDoc.id,
    resultado: "encontrado",
    quantidade: "1",
    scanUuid: input.scanUuid ?? null,
    usuarioId: actor.id,
  })

  progress = await notaProgress(input.notaId)
  await db.update(notas).set({ itensConferidos: progress.itensCompletos }).where(eq(notas.id, input.notaId))

  const payload = gamePayload({ ...itemDoc, quantidadeConferida: String(newQty) })
  return {
    success: true,
    tipo: completed ? "completo" : "parcial",
    message: completed ? "Item conferido!" : `${newQty} de ${qtyNum(itemDoc.quantidade)}`,
    item: payload,
    progress,
    notaCompleta: progress.itensCompletos >= progress.totalItens,
  }
}

/** Vincula manualmente um item a um produto e registra o aprendizado (equivalência + histórico). */
export async function vincularItem(input: { itemNotaId: number; produtoId: number }) {
  const actor = await requirePermission("conferir")

  const [item] = await db.select().from(itensNota).where(eq(itensNota.id, input.itemNotaId)).limit(1)
  if (!item) return { ok: false as const, error: "Item não encontrado." }
  const [produto] = await db.select().from(produtos).where(eq(produtos.id, input.produtoId)).limit(1)
  if (!produto) return { ok: false as const, error: "Produto não encontrado." }
  const [nota] = await db.select().from(notas).where(eq(notas.id, item.notaId)).limit(1)

  await db
    .update(itensNota)
    .set({ produtoId: produto.id, matchTipo: "manual", matchScore: 100, updatedAt: new Date() })
    .where(eq(itensNota.id, item.id))

  // Aprendizado: só registra se houver CNPJ do fornecedor (necessário para reconhecer no futuro).
  if (nota?.fornecedorCnpj) {
    await db.insert(historicoAprendizado).values({
      itemNotaId: item.id,
      produtoId: produto.id,
      descricaoFornecedor: item.descricaoFornecedor,
      codigoFornecedor: item.codigoFornecedor,
      ean: item.ean,
      acao: "vinculado",
      score: 100,
      usuarioId: actor.id,
    })

    const [existing] = await db
      .select()
      .from(equivalenciaProdutos)
      .where(
        and(
          eq(equivalenciaProdutos.fornecedorCnpj, nota.fornecedorCnpj),
          eq(equivalenciaProdutos.codigoFornecedor, item.codigoFornecedor ?? ""),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(equivalenciaProdutos)
        .set({
          produtoId: produto.id,
          vezesUsado: existing.vezesUsado + 1,
          descricaoFornecedor: item.descricaoFornecedor,
          ean: item.ean,
          updatedAt: new Date(),
        })
        .where(eq(equivalenciaProdutos.id, existing.id))
    } else {
      await db.insert(equivalenciaProdutos).values({
        produtoId: produto.id,
        fornecedorId: nota.fornecedorId,
        fornecedorCnpj: nota.fornecedorCnpj,
        codigoFornecedor: item.codigoFornecedor,
        descricaoFornecedor: item.descricaoFornecedor,
        ean: item.ean,
        createdBy: actor.id,
      })
    }
  }

  // Herda o EAN da NF-e como código de barras do produto se ele ainda não tiver.
  if (item.ean && !produto.codigoBarras) {
    await db.update(produtos).set({ codigoBarras: item.ean, updatedAt: new Date() }).where(eq(produtos.id, produto.id))
  }

  revalidatePath(`/conferencia/${item.notaId}`)
  return { ok: true as const }
}

/** Adiciona um código de barras ao produto vinculado ao item e conta +1 (usado quando a NF-e não trouxe EAN). */
export async function adicionarCodigoItem(input: {
  notaId: number
  itemNotaId: number
  codigoBarras: string
  scanUuid?: string | null
}): Promise<LeituraResult> {
  const actor = await requirePermission("conferir")
  const codigo = input.codigoBarras.trim()

  const [item] = await db.select().from(itensNota).where(eq(itensNota.id, input.itemNotaId)).limit(1)
  if (!item || item.notaId !== input.notaId) {
    return { success: false, tipo: "desconhecido", message: "Item não encontrado.", item: null, progress: await notaProgress(input.notaId), notaCompleta: false }
  }
  if (!item.produtoId) {
    return { success: false, tipo: "desconhecido", message: "Item ainda não possui produto vinculado.", item: null, progress: await notaProgress(input.notaId), notaCompleta: false }
  }

  if (input.scanUuid) {
    const [ja] = await db
      .select()
      .from(historicoLeituras)
      .where(and(eq(historicoLeituras.notaId, input.notaId), eq(historicoLeituras.scanUuid, input.scanUuid)))
      .limit(1)
    if (ja) {
      const progress = await notaProgress(input.notaId)
      return { success: true, tipo: "duplicado_ignorado", message: "Leitura já registrada.", item: gamePayload(item), progress, notaCompleta: progress.itensCompletos >= progress.totalItens }
    }
  }

  // Salva o código de barras no produto (para reconhecimento automático futuro).
  await db.update(produtos).set({ codigoBarras: codigo, updatedAt: new Date() }).where(eq(produtos.id, item.produtoId))

  if (qtyNum(item.quantidadeConferida) >= qtyNum(item.quantidade)) {
    const progress = await notaProgress(input.notaId)
    return { success: false, tipo: "ja_conferido", message: "Este item já foi conferido!", item: gamePayload(item), progress, notaCompleta: false }
  }

  const newQty = qtyNum(item.quantidadeConferida) + 1
  const completed = newQty >= qtyNum(item.quantidade)
  await db
    .update(itensNota)
    .set({ quantidadeConferida: String(newQty), statusConferencia: completed ? "conferido" : "em_contagem", updatedAt: new Date() })
    .where(eq(itensNota.id, item.id))

  await db.insert(historicoLeituras).values({
    notaId: input.notaId,
    codigoLido: codigo,
    produtoId: item.produtoId,
    itemNotaId: item.id,
    resultado: "encontrado",
    quantidade: "1",
    scanUuid: input.scanUuid ?? null,
    usuarioId: actor.id,
  })

  const progress = await notaProgress(input.notaId)
  await db.update(notas).set({ itensConferidos: progress.itensCompletos }).where(eq(notas.id, input.notaId))

  return {
    success: true,
    tipo: completed ? "completo" : "parcial",
    message: completed ? "Item conferido!" : `${newQty} de ${qtyNum(item.quantidade)}`,
    item: gamePayload({ ...item, quantidadeConferida: String(newQty) }),
    progress,
    notaCompleta: progress.itensCompletos >= progress.totalItens,
  }
}

export async function finalizarConferencia(notaId: number) {
  const actor = await requirePermission("conferir")
  const progress = await notaProgress(notaId)
  const status = progress.itensCompletos >= progress.totalItens ? "conferida" : "divergente"
  await db
    .update(notas)
    .set({ status, itensConferidos: progress.itensCompletos, conferidaEm: new Date(), updatedAt: new Date() })
    .where(eq(notas.id, notaId))

  const [nota] = await db.select({ numero: notas.numero }).from(notas).where(eq(notas.id, notaId)).limit(1)
  await registrarLog({
    actor,
    area: "conferencia",
    acao: "conferiu",
    detalhe: `Finalizou a conferência da NF-e ${nota?.numero ?? `#${notaId}`} como ${
      status === "conferida" ? "CONFERIDA" : "DIVERGENTE"
    } (${progress.itensCompletos}/${progress.totalItens} itens).`,
  })

  revalidatePath(`/conferencia/${notaId}`)
  revalidatePath("/conferencia")
  return { ok: true as const, status }
}

/** Ajuste manual da quantidade conferida de um item (correção). */
export async function ajustarQuantidade(input: { itemNotaId: number; notaId: number; quantidadeConferida: number }) {
  await requirePermission("conferir")
  const [item] = await db.select().from(itensNota).where(eq(itensNota.id, input.itemNotaId)).limit(1)
  if (!item) return { ok: false as const, error: "Item não encontrado." }
  const q = Math.max(0, input.quantidadeConferida)
  const completed = q >= qtyNum(item.quantidade) && qtyNum(item.quantidade) > 0
  await db
    .update(itensNota)
    .set({ quantidadeConferida: String(q), statusConferencia: completed ? "conferido" : q > 0 ? "em_contagem" : "pendente", updatedAt: new Date() })
    .where(eq(itensNota.id, item.id))
  const progress = await notaProgress(input.notaId)
  await db.update(notas).set({ itensConferidos: progress.itensCompletos }).where(eq(notas.id, input.notaId))
  revalidatePath(`/conferencia/${input.notaId}`)
  return { ok: true as const }
}
