"use server"

import { revalidatePath } from "next/cache"
import { and, asc, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  auditorias,
  auditoriaEstoqueOficial,
  auditoriaContagens,
  auditoriaRelatorios,
} from "@/lib/db/schema"
import { requireActor, requirePermission } from "@/lib/guards"
import { registrarLog } from "@/lib/logs"

// ---------------------------------------------------------------------------
// Tipos compartilhados com a UI.
// ---------------------------------------------------------------------------

export type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string }

export type StatusAuditoria = "em_andamento" | "finalizada"

export type Auditoria = {
  id: number
  nome: string
  status: StatusAuditoria
  createdByNome: string | null
  createdAt: string
  finalizadaEm: string | null
  totalContagens: number
  totalOficial: number
}

export type Contagem = {
  id: number
  codigo: string
  andar: string
  rua: string
  box: string
  localizacaoFull: string
  quantidade: number
  observacao: string | null
  createdByNome: string | null
  createdAt: string
}

export type LinhaOficial = {
  codigo: string
  descricao: string | null
  quantidadeSistema: number
  localizacaoPrincipal: string | null
}

// Status de cada item ao comparar contagem física × estoque oficial.
export type StatusItem = "correto" | "sobra" | "falta" | "sem_cadastro" | "nao_encontrado"

export type ItemRelatorio = {
  codigo: string
  descricao: string | null
  quantidadeSistema: number
  quantidadeContada: number
  diferenca: number
  status: StatusItem
  localizacoes: { local: string; quantidade: number }[]
  multiplasLocalizacoes: boolean
  observacoes: string[]
}

export type ResumoRelatorio = {
  totalImportados: number
  totalConferidos: number
  totalDivergencias: number
  corretos: number
  sobras: number
  faltas: number
  naoEncontrados: number
  semCadastro: number
  multiplasLocalizacoes: number
  percentualConcluido: number
  itens: ItemRelatorio[]
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function iso(value: Date | string | null): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

// Normaliza qualquer texto de localização/parte para MAIÚSCULAS sem espaços extras.
function up(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ")
}

// Monta a localização no padrão da empresa: "G + Rua + Box" (ex.: "G1 R18 BX31A").
function montarLocalizacao(andar: string, rua: string, box: string): string {
  return [up(andar), up(rua), up(box)].filter(Boolean).join(" ")
}

// Constrói o relatório consolidado a partir das contagens + estoque oficial.
// Consolidação: soma por código (nunca duplica produto), mantendo TODAS as
// localizações. Comparação: correto/sobra/falta; produtos só no físico viram
// "sem_cadastro"; produtos só no oficial viram "nao_encontrado".
function construirResumo(oficial: LinhaOficial[], contagens: Contagem[]): ResumoRelatorio {
  const oficialPorCodigo = new Map<string, LinhaOficial>()
  for (const linha of oficial) oficialPorCodigo.set(up(linha.codigo), linha)

  // Agrupa contagens por código.
  const contadosPorCodigo = new Map<
    string,
    { total: number; locais: Map<string, number>; observacoes: string[] }
  >()
  for (const c of contagens) {
    const codigo = up(c.codigo)
    const grupo = contadosPorCodigo.get(codigo) ?? { total: 0, locais: new Map<string, number>(), observacoes: [] as string[] }
    grupo.total += toNumber(c.quantidade)
    grupo.locais.set(c.localizacaoFull, (grupo.locais.get(c.localizacaoFull) ?? 0) + toNumber(c.quantidade))
    if (c.observacao?.trim()) grupo.observacoes.push(c.observacao.trim())
    contadosPorCodigo.set(codigo, grupo)
  }

  const itens: ItemRelatorio[] = []
  const codigos = new Set<string>([...oficialPorCodigo.keys(), ...contadosPorCodigo.keys()])

  for (const codigo of codigos) {
    const ref = oficialPorCodigo.get(codigo) ?? null
    const contado = contadosPorCodigo.get(codigo)
    const quantidadeSistema = ref ? toNumber(ref.quantidadeSistema) : 0
    const quantidadeContada = contado ? contado.total : 0
    const localizacoes = contado
      ? [...contado.locais.entries()].map(([local, quantidade]) => ({ local, quantidade }))
      : []
    const multiplasLocalizacoes = localizacoes.length > 1

    let status: StatusItem
    if (!ref) status = "sem_cadastro"
    else if (!contado) status = "nao_encontrado"
    else if (quantidadeContada === quantidadeSistema) status = "correto"
    else if (quantidadeContada > quantidadeSistema) status = "sobra"
    else status = "falta"

    itens.push({
      codigo,
      descricao: ref?.descricao ?? null,
      quantidadeSistema,
      quantidadeContada,
      diferenca: quantidadeContada - quantidadeSistema,
      status,
      localizacoes,
      multiplasLocalizacoes,
      observacoes: contado?.observacoes ?? [],
    })
  }

  itens.sort((a, b) => a.codigo.localeCompare(b.codigo))

  const corretos = itens.filter((i) => i.status === "correto").length
  const sobras = itens.filter((i) => i.status === "sobra").length
  const faltas = itens.filter((i) => i.status === "falta").length
  const naoEncontrados = itens.filter((i) => i.status === "nao_encontrado").length
  const semCadastro = itens.filter((i) => i.status === "sem_cadastro").length
  const multiplasLocalizacoes = itens.filter((i) => i.multiplasLocalizacoes).length
  const totalImportados = oficialPorCodigo.size
  const totalConferidos = contadosPorCodigo.size
  const percentualConcluido = totalImportados === 0 ? 0 : Math.round((corretos + sobras + faltas) / totalImportados * 100)

  return {
    totalImportados,
    totalConferidos,
    totalDivergencias: sobras + faltas + naoEncontrados + semCadastro,
    corretos,
    sobras,
    faltas,
    naoEncontrados,
    semCadastro,
    multiplasLocalizacoes,
    percentualConcluido,
    itens,
  }
}

// ---------------------------------------------------------------------------
// Leitura.
// ---------------------------------------------------------------------------

export async function listAuditorias(): Promise<Auditoria[]> {
  await requireActor()
  const rows = await db.select().from(auditorias).orderBy(desc(auditorias.createdAt))
  const result: Auditoria[] = []
  for (const row of rows) {
    const contagens = await db
      .select({ id: auditoriaContagens.id })
      .from(auditoriaContagens)
      .where(eq(auditoriaContagens.auditoriaId, row.id))
    const oficial = await db
      .select({ id: auditoriaEstoqueOficial.id })
      .from(auditoriaEstoqueOficial)
      .where(eq(auditoriaEstoqueOficial.auditoriaId, row.id))
    result.push({
      id: row.id,
      nome: row.nome,
      status: row.status as StatusAuditoria,
      createdByNome: row.createdByNome,
      createdAt: iso(row.createdAt)!,
      finalizadaEm: iso(row.finalizadaEm),
      totalContagens: contagens.length,
      totalOficial: oficial.length,
    })
  }
  return result
}

export async function getAuditoria(id: number): Promise<{
  auditoria: Auditoria
  contagens: Contagem[]
  oficial: LinhaOficial[]
} | null> {
  await requireActor()
  const [row] = await db.select().from(auditorias).where(eq(auditorias.id, id)).limit(1)
  if (!row) return null

  const contagensRows = await db
    .select()
    .from(auditoriaContagens)
    .where(eq(auditoriaContagens.auditoriaId, id))
    .orderBy(desc(auditoriaContagens.createdAt))
  const oficialRows = await db
    .select()
    .from(auditoriaEstoqueOficial)
    .where(eq(auditoriaEstoqueOficial.auditoriaId, id))
    .orderBy(asc(auditoriaEstoqueOficial.codigo))

  const contagens: Contagem[] = contagensRows.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    andar: c.andar,
    rua: c.rua,
    box: c.box,
    localizacaoFull: c.localizacaoFull,
    quantidade: toNumber(c.quantidade),
    observacao: c.observacao,
    createdByNome: c.createdByNome,
    createdAt: iso(c.createdAt)!,
  }))
  const oficial: LinhaOficial[] = oficialRows.map((o) => ({
    codigo: o.codigo,
    descricao: o.descricao,
    quantidadeSistema: toNumber(o.quantidadeSistema),
    localizacaoPrincipal: o.localizacaoPrincipal,
  }))

  return {
    auditoria: {
      id: row.id,
      nome: row.nome,
      status: row.status as StatusAuditoria,
      createdByNome: row.createdByNome,
      createdAt: iso(row.createdAt)!,
      finalizadaEm: iso(row.finalizadaEm),
      totalContagens: contagens.length,
      totalOficial: oficial.length,
    },
    contagens,
    oficial,
  }
}

// Resumo consolidado sob demanda (dashboard e prévia do relatório).
export async function getResumo(id: number): Promise<ResumoRelatorio | null> {
  const dados = await getAuditoria(id)
  if (!dados) return null
  return construirResumo(dados.oficial, dados.contagens)
}

// ---------------------------------------------------------------------------
// Escrita.
// ---------------------------------------------------------------------------

export async function criarAuditoria(nome: string): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await requirePermission("conferir")
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) return { ok: false, error: "Informe um nome para a auditoria." }
    const [row] = await db
      .insert(auditorias)
      .values({ nome: nomeLimpo, createdBy: actor.id, createdByNome: actor.name })
      .returning()
    await registrarLog({ actor, area: "auditoria", acao: "criou", detalhe: `Criou a auditoria "${nomeLimpo}".` })
    revalidatePath("/estoque/auditoria")
    return { ok: true, data: { id: row.id } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao criar auditoria." }
  }
}

export async function excluirAuditoria(id: number): Promise<ActionResult> {
  try {
    const actor = await requirePermission("conferir")
    const [row] = await db.select().from(auditorias).where(eq(auditorias.id, id)).limit(1)
    if (!row) return { ok: false, error: "Auditoria não encontrada." }
    await db.delete(auditorias).where(eq(auditorias.id, id))
    await registrarLog({ actor, area: "auditoria", acao: "excluiu", detalhe: `Excluiu a auditoria "${row.nome}".` })
    revalidatePath("/estoque/auditoria")
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao excluir auditoria." }
  }
}

// Registra uma leitura física. Não duplica: se já existir contagem para o mesmo
// código na mesma localização, soma a quantidade nela.
export async function registrarContagem(input: {
  auditoriaId: number
  codigo: string
  andar: string
  rua: string
  box: string
  quantidade: number
  observacao?: string
}): Promise<ActionResult<{ contagem: Contagem }>> {
  try {
    const actor = await requirePermission("conferir")
    const [aud] = await db.select().from(auditorias).where(eq(auditorias.id, input.auditoriaId)).limit(1)
    if (!aud) return { ok: false, error: "Auditoria não encontrada." }
    if (aud.status === "finalizada") return { ok: false, error: "Esta auditoria já foi finalizada." }

    const codigo = up(input.codigo)
    if (!codigo) return { ok: false, error: "Informe o código do produto." }
    const andar = up(input.andar)
    const rua = up(input.rua)
    const box = up(input.box)
    if (!andar || !rua || !box) return { ok: false, error: "Informe andar, rua e box da localização." }
    const localizacaoFull = montarLocalizacao(andar, rua, box)
    const quantidade = toNumber(input.quantidade)
    if (quantidade <= 0) return { ok: false, error: "A quantidade deve ser maior que zero." }

    // Consolida na mesma localização.
    const [existente] = await db
      .select()
      .from(auditoriaContagens)
      .where(
        and(
          eq(auditoriaContagens.auditoriaId, input.auditoriaId),
          eq(auditoriaContagens.codigo, codigo),
          eq(auditoriaContagens.localizacaoFull, localizacaoFull),
        ),
      )
      .limit(1)

    let row
    if (existente) {
      const novaQtd = toNumber(existente.quantidade) + quantidade
      const observacao = input.observacao?.trim() || existente.observacao
      ;[row] = await db
        .update(auditoriaContagens)
        .set({ quantidade: String(novaQtd), observacao })
        .where(eq(auditoriaContagens.id, existente.id))
        .returning()
    } else {
      ;[row] = await db
        .insert(auditoriaContagens)
        .values({
          auditoriaId: input.auditoriaId,
          codigo,
          andar,
          rua,
          box,
          localizacaoFull,
          quantidade: String(quantidade),
          observacao: input.observacao?.trim() || null,
          createdBy: actor.id,
          createdByNome: actor.name,
        })
        .returning()
    }

    await registrarLog({
      actor,
      area: "auditoria",
      acao: "contou",
      detalhe: `Contou ${quantidade}× do código ${codigo} em ${localizacaoFull} (auditoria "${aud.nome}").`,
    })
    revalidatePath("/estoque/auditoria")
    return {
      ok: true,
      data: {
        contagem: {
          id: row.id,
          codigo: row.codigo,
          andar: row.andar,
          rua: row.rua,
          box: row.box,
          localizacaoFull: row.localizacaoFull,
          quantidade: toNumber(row.quantidade),
          observacao: row.observacao,
          createdByNome: row.createdByNome,
          createdAt: iso(row.createdAt)!,
        },
      },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao registrar contagem." }
  }
}

// Ajusta manualmente a quantidade de uma leitura (correção de digitação).
export async function atualizarContagem(id: number, quantidade: number): Promise<ActionResult> {
  try {
    const actor = await requirePermission("conferir")
    const [row] = await db.select().from(auditoriaContagens).where(eq(auditoriaContagens.id, id)).limit(1)
    if (!row) return { ok: false, error: "Contagem não encontrada." }
    const qtd = toNumber(quantidade)
    if (qtd <= 0) {
      await db.delete(auditoriaContagens).where(eq(auditoriaContagens.id, id))
      await registrarLog({ actor, area: "auditoria", acao: "removeu", detalhe: `Removeu a contagem do código ${row.codigo} em ${row.localizacaoFull}.` })
    } else {
      await db.update(auditoriaContagens).set({ quantidade: String(qtd) }).where(eq(auditoriaContagens.id, id))
      await registrarLog({ actor, area: "auditoria", acao: "ajustou", detalhe: `Ajustou a contagem do código ${row.codigo} em ${row.localizacaoFull} para ${qtd}.` })
    }
    revalidatePath("/estoque/auditoria")
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao atualizar contagem." }
  }
}

export async function removerContagem(id: number): Promise<ActionResult> {
  return atualizarContagem(id, 0)
}

// Importa o estoque oficial (parseado no cliente a partir de Excel/CSV).
// Substitui totalmente a referência anterior desta auditoria.
export async function importarEstoqueOficial(
  auditoriaId: number,
  linhas: LinhaOficial[],
): Promise<ActionResult<{ total: number }>> {
  try {
    const actor = await requirePermission("conferir")
    const [aud] = await db.select().from(auditorias).where(eq(auditorias.id, auditoriaId)).limit(1)
    if (!aud) return { ok: false, error: "Auditoria não encontrada." }

    const validas = linhas
      .map((l) => ({
        codigo: up(String(l.codigo ?? "")),
        descricao: l.descricao?.toString().trim() || null,
        quantidadeSistema: String(toNumber(l.quantidadeSistema)),
        localizacaoPrincipal: l.localizacaoPrincipal?.toString().trim() || null,
      }))
      .filter((l) => l.codigo)

    if (validas.length === 0) return { ok: false, error: "Nenhuma linha válida encontrada no arquivo. Verifique a coluna de código." }

    await db.delete(auditoriaEstoqueOficial).where(eq(auditoriaEstoqueOficial.auditoriaId, auditoriaId))
    // Insere em lotes para evitar payloads gigantes.
    const chunkSize = 500
    for (let i = 0; i < validas.length; i += chunkSize) {
      const chunk = validas.slice(i, i + chunkSize).map((l) => ({ ...l, auditoriaId }))
      await db.insert(auditoriaEstoqueOficial).values(chunk)
    }

    await registrarLog({
      actor,
      area: "auditoria",
      acao: "importou",
      detalhe: `Importou o estoque oficial (${validas.length} itens) na auditoria "${aud.nome}".`,
    })
    revalidatePath("/estoque/auditoria")
    return { ok: true, data: { total: validas.length } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao importar estoque oficial." }
  }
}

// Finaliza a auditoria: gera e persiste o snapshot do relatório consolidado.
export async function finalizarAuditoria(id: number): Promise<ActionResult<{ resumo: ResumoRelatorio }>> {
  try {
    const actor = await requirePermission("conferir")
    const dados = await getAuditoria(id)
    if (!dados) return { ok: false, error: "Auditoria não encontrada." }
    if (dados.oficial.length === 0) return { ok: false, error: "Importe o estoque oficial antes de finalizar." }

    const resumo = construirResumo(dados.oficial, dados.contagens)
    await db
      .update(auditorias)
      .set({ status: "finalizada", finalizadaEm: new Date() })
      .where(eq(auditorias.id, id))
    await db.insert(auditoriaRelatorios).values({
      auditoriaId: id,
      resumoJson: resumo,
      createdBy: actor.id,
      createdByNome: actor.name,
    })
    await registrarLog({
      actor,
      area: "auditoria",
      acao: "finalizou",
      detalhe: `Finalizou a auditoria "${dados.auditoria.nome}": ${resumo.totalDivergencias} divergência(s) em ${resumo.totalImportados} itens.`,
    })
    revalidatePath("/estoque/auditoria")
    return { ok: true, data: { resumo } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao finalizar auditoria." }
  }
}

// Reabre uma auditoria finalizada para continuar contando.
export async function reabrirAuditoria(id: number): Promise<ActionResult> {
  try {
    const actor = await requirePermission("conferir")
    const [row] = await db.select().from(auditorias).where(eq(auditorias.id, id)).limit(1)
    if (!row) return { ok: false, error: "Auditoria não encontrada." }
    await db.update(auditorias).set({ status: "em_andamento", finalizadaEm: null }).where(eq(auditorias.id, id))
    await registrarLog({ actor, area: "auditoria", acao: "reabriu", detalhe: `Reabriu a auditoria "${row.nome}".` })
    revalidatePath("/estoque/auditoria")
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao reabrir auditoria." }
  }
}
