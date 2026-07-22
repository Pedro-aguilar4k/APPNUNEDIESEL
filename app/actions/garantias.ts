"use server"

import { db } from "@/lib/db"
import { garantias, garantiaRejeicoes } from "@/lib/db/schema"
import { and, desc, eq, gt, lt } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"
import { registrarLog } from "@/lib/logs"
import { revalidatePath } from "next/cache"
import {
  GARANTIA_STATUS,
  GARANTIA_STATUS_LABELS,
  FRETE_CONTA,
  PROCEDENCIA,
  TIPO_RETORNO,
  type GarantiaStatus,
  type Garantia,
  type GarantiaRejeicao,
  type NovaGarantiaInput,
} from "@/lib/garantias"

type GarantiaResult = { ok: true; protocolo: string } | { ok: false; error: string }

function clean(v?: string | null): string | null {
  const t = (v ?? "").trim()
  return t.length ? t : null
}

/** Vendedor abre um ticket de garantia. O dono é sempre o usuário logado. */
export async function abrirGarantia(input: NovaGarantiaInput): Promise<GarantiaResult> {
  try {
    const actor = await requirePermission("abrir_garantia")

    const clienteNome = clean(input.clienteNome)
    const produtoDescricao = clean(input.produtoDescricao)
    const descricaoDefeito = clean(input.descricaoDefeito)

    if (!clienteNome) return { ok: false, error: "Informe o nome do cliente." }
    if (!produtoDescricao) return { ok: false, error: "Informe a descrição da peça/produto." }
    if (!descricaoDefeito) return { ok: false, error: "Descreva o defeito apresentado." }

    // O protocolo é derivado do id (serial atômico) para evitar condição de corrida
    // entre aberturas simultâneas. Insere com placeholder e atualiza com o id real.
    const [inserida] = await db
      .insert(garantias)
      .values({
        protocolo: "",
        vendedorId: actor.id,
        vendedorNome: actor.name,
        status: "pendente",
        clienteNome,
        clienteContato: clean(input.clienteContato),
        clienteFone: clean(input.clienteFone),
        clienteEmail: clean(input.clienteEmail),
        notaNumero: clean(input.notaNumero),
        dataCompra: clean(input.dataCompra),
        loja: clean(input.loja),
        pecaNumero: clean(input.pecaNumero),
        produtoDescricao,
        pecaMarca: clean(input.pecaMarca),
        veiculo: clean(input.veiculo),
        anoModelo: clean(input.anoModelo),
        motor: clean(input.motor),
        kmInicial: clean(input.kmInicial),
        kmDefeito: clean(input.kmDefeito),
        kmRodado: clean(input.kmRodado),
        horasRodadas: clean(input.horasRodadas),
        dataAplicacao: clean(input.dataAplicacao),
        dataDefeito: clean(input.dataDefeito),
        descricaoDefeito,
        createdBy: actor.id,
      })
      .returning({ id: garantias.id })

    const protocolo = `GAR-${String(inserida.id).padStart(6, "0")}`
    await db.update(garantias).set({ protocolo }).where(eq(garantias.id, inserida.id))

    await registrarLog({
      actor,
      area: "garantias",
      acao: "abriu",
      detalhe: `Abriu a garantia ${protocolo} para ${clienteNome} (${produtoDescricao}).`,
    })

    revalidatePath("/garantias")
    revalidatePath("/estoque/garantia")
    return { ok: true, protocolo }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao abrir a garantia." }
  }
}

/** Lista as garantias do próprio vendedor logado. */
export async function listMinhasGarantias(): Promise<Garantia[]> {
  const actor = await requirePermission("abrir_garantia")
  return db
    .select()
    .from(garantias)
    .where(eq(garantias.vendedorId, actor.id))
    .orderBy(desc(garantias.createdAt))
}

/**
 * Avisos de rejeição ativos do vendedor logado (não expirados e não reabertos).
 * Também limpa oportunisticamente os avisos vencidos (> 48h).
 */
export async function listMinhasRejeicoes(): Promise<GarantiaRejeicao[]> {
  const actor = await requirePermission("abrir_garantia")
  const agora = new Date()
  // Limpeza dos avisos expirados (best-effort).
  await db.delete(garantiaRejeicoes).where(lt(garantiaRejeicoes.expiraEm, agora))
  return db
    .select()
    .from(garantiaRejeicoes)
    .where(
      and(
        eq(garantiaRejeicoes.vendedorId, actor.id),
        eq(garantiaRejeicoes.reaberta, false),
        gt(garantiaRejeicoes.expiraEm, agora),
      ),
    )
    .orderBy(desc(garantiaRejeicoes.rejeitadaEm))
}

/**
 * Vendedor reabre um ticket rejeitado: recria a garantia a partir do snapshot
 * (novo protocolo, status Pendente) e marca o aviso como reaberto.
 */
export async function reabrirGarantia(rejeicaoId: number): Promise<GarantiaResult> {
  try {
    const actor = await requirePermission("abrir_garantia")
    const [rej] = await db
      .select()
      .from(garantiaRejeicoes)
      .where(and(eq(garantiaRejeicoes.id, rejeicaoId), eq(garantiaRejeicoes.vendedorId, actor.id)))
      .limit(1)
    if (!rej) return { ok: false, error: "Aviso de rejeição não encontrado." }
    if (rej.reaberta) return { ok: false, error: "Este ticket já foi reaberto." }
    if (rej.expiraEm < new Date()) return { ok: false, error: "O prazo de 48h para reabrir expirou." }

    const orig = rej.dadosOriginais as Garantia

    const [inserida] = await db
      .insert(garantias)
      .values({
        protocolo: "",
        vendedorId: actor.id,
        vendedorNome: actor.name,
        status: "pendente",
        clienteNome: orig.clienteNome,
        clienteContato: orig.clienteContato,
        clienteFone: orig.clienteFone,
        clienteEmail: orig.clienteEmail,
        notaNumero: orig.notaNumero,
        dataCompra: orig.dataCompra,
        loja: orig.loja,
        pecaNumero: orig.pecaNumero,
        produtoDescricao: orig.produtoDescricao,
        pecaMarca: orig.pecaMarca,
        veiculo: orig.veiculo,
        anoModelo: orig.anoModelo,
        motor: orig.motor,
        kmInicial: orig.kmInicial,
        kmDefeito: orig.kmDefeito,
        kmRodado: orig.kmRodado,
        horasRodadas: orig.horasRodadas,
        dataAplicacao: orig.dataAplicacao,
        dataDefeito: orig.dataDefeito,
        descricaoDefeito: orig.descricaoDefeito,
        createdBy: actor.id,
      })
      .returning({ id: garantias.id })

    const protocolo = `GAR-${String(inserida.id).padStart(6, "0")}`
    await db.update(garantias).set({ protocolo }).where(eq(garantias.id, inserida.id))
    await db.update(garantiaRejeicoes).set({ reaberta: true }).where(eq(garantiaRejeicoes.id, rejeicaoId))

    await registrarLog({
      actor,
      area: "garantias",
      acao: "reabriu",
      detalhe: `Reabriu a garantia (antes ${rej.protocolo}) — novo protocolo ${protocolo}.`,
    })
    revalidatePath("/garantias")
    revalidatePath("/estoque/garantia")
    return { ok: true, protocolo }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao reabrir a garantia." }
  }
}

/** Lista todas as garantias (board interno da equipe). */
export async function listGarantias(): Promise<Garantia[]> {
  await requirePermission("gerenciar_garantia")
  return db.select().from(garantias).orderBy(desc(garantias.createdAt))
}

async function getGarantia(id: number): Promise<Garantia | undefined> {
  const [g] = await db.select().from(garantias).where(eq(garantias.id, id)).limit(1)
  return g
}

/**
 * TRIAGEM (Pendente): aprovar joga o ticket direto para "Em análise".
 */
export async function aprovarTriagemGarantia(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requirePermission("gerenciar_garantia")
    const g = await getGarantia(id)
    if (!g) return { ok: false, error: "Garantia não encontrada." }
    if (g.status !== "pendente") return { ok: false, error: "Esta garantia não está na triagem." }

    await db
      .update(garantias)
      .set({ status: "em_analise", updatedAt: new Date() })
      .where(eq(garantias.id, id))
    await registrarLog({
      actor,
      area: "garantias",
      acao: "aprovou",
      detalhe: `Aprovou a triagem da garantia ${g.protocolo} — enviada para análise.`,
    })
    revalidatePath("/estoque/garantia")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao aprovar triagem." }
  }
}

/**
 * ANÁLISE (Em análise): validar o prazo da garantia (registra a data limite) e
 * já avança para "Enviado".
 */
export async function validarPrazoGarantia(
  id: number,
  prazoGarantia: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requirePermission("gerenciar_garantia")
    const prazo = clean(prazoGarantia)
    if (!prazo) return { ok: false, error: "Informe a data do prazo da garantia." }
    const g = await getGarantia(id)
    if (!g) return { ok: false, error: "Garantia não encontrada." }
    if (g.status !== "em_analise") return { ok: false, error: "Esta garantia não está em análise." }

    await db
      .update(garantias)
      .set({ prazoGarantia: prazo, prazoValidado: true, status: "enviado", updatedAt: new Date() })
      .where(eq(garantias.id, id))
    await registrarLog({
      actor,
      area: "garantias",
      acao: "validou_prazo",
      detalhe: `Validou o prazo (${prazo}) da garantia ${g.protocolo} — enviada para envio.`,
    })
    revalidatePath("/estoque/garantia")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao validar prazo." }
  }
}

/**
 * ENVIO (Enviado): cadastra NFG + dados da transportadora. NÃO avança de etapa —
 * só marca o envio como cadastrado. O avanço é feito por `avancarEtapaGarantia`.
 */
export async function cadastrarEnvioGarantia(
  id: number,
  input: { nfgNumero: string; transportadoraNome?: string; dataEnvio?: string; freteConta?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requirePermission("gerenciar_garantia")
    const nfg = clean(input.nfgNumero)
    if (!nfg) return { ok: false, error: "Informe o número da NFG (nota fiscal de garantia)." }
    const frete = clean(input.freteConta)
    if (frete && !FRETE_CONTA.includes(frete as (typeof FRETE_CONTA)[number])) {
      return { ok: false, error: "Opção de frete inválida." }
    }
    const g = await getGarantia(id)
    if (!g) return { ok: false, error: "Garantia não encontrada." }
    if (g.status !== "enviado") return { ok: false, error: "Esta garantia não está na etapa de envio." }

    await db
      .update(garantias)
      .set({
        nfgNumero: nfg,
        transportadoraNome: clean(input.transportadoraNome),
        dataEnvio: clean(input.dataEnvio),
        freteConta: frete,
        envioCadastrado: true,
        updatedAt: new Date(),
      })
      .where(eq(garantias.id, id))
    await registrarLog({
      actor,
      area: "garantias",
      acao: "cadastrou_envio",
      detalhe: `Cadastrou o envio da garantia ${g.protocolo} (NFG ${nfg}).`,
    })
    revalidatePath("/estoque/garantia")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao cadastrar envio." }
  }
}

/**
 * ENVIO → RETORNO: avança de "Enviado" para "Esperando retorno". Só permite se
 * o envio já foi cadastrado (NFG preenchida).
 */
export async function avancarEtapaGarantia(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requirePermission("gerenciar_garantia")
    const g = await getGarantia(id)
    if (!g) return { ok: false, error: "Garantia não encontrada." }
    if (g.status !== "enviado") return { ok: false, error: "Só é possível avançar a partir do envio." }
    if (!g.envioCadastrado || !g.nfgNumero) {
      return { ok: false, error: "Cadastre o envio (NFG) antes de avançar de etapa." }
    }

    await db
      .update(garantias)
      .set({ status: "esperando_retorno", updatedAt: new Date() })
      .where(eq(garantias.id, id))
    await registrarLog({
      actor,
      area: "garantias",
      acao: "status",
      detalhe: `Avançou a garantia ${g.protocolo} para "Esperando retorno".`,
    })
    revalidatePath("/estoque/garantia")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao avançar etapa." }
  }
}

/**
 * RETORNO (Esperando retorno): registra os dados do retorno e conclui o ticket.
 */
export async function registrarRetornoGarantia(
  id: number,
  input: { notaEntrada?: string; procedencia: string; tipoRetorno: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requirePermission("gerenciar_garantia")
    const procedencia = clean(input.procedencia)
    const tipoRetorno = clean(input.tipoRetorno)
    if (!procedencia || !PROCEDENCIA.includes(procedencia as (typeof PROCEDENCIA)[number])) {
      return { ok: false, error: "Selecione se a garantia foi procedente ou improcedente." }
    }
    if (!tipoRetorno || !TIPO_RETORNO.includes(tipoRetorno as (typeof TIPO_RETORNO)[number])) {
      return { ok: false, error: "Selecione como o valor/peça vai retornar." }
    }
    const g = await getGarantia(id)
    if (!g) return { ok: false, error: "Garantia não encontrada." }
    if (g.status !== "esperando_retorno") return { ok: false, error: "Esta garantia não está aguardando retorno." }

    await db
      .update(garantias)
      .set({
        notaEntrada: clean(input.notaEntrada),
        procedencia,
        tipoRetorno,
        status: "concluido",
        concluidoEm: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(garantias.id, id))
    await registrarLog({
      actor,
      area: "garantias",
      acao: "concluiu",
      detalhe: `Concluiu a garantia ${g.protocolo} (${procedencia}, retorno: ${tipoRetorno}).`,
    })
    revalidatePath("/estoque/garantia")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao registrar retorno." }
  }
}

/**
 * REJEIÇÃO: pode ocorrer na triagem (pendente) ou por prazo inválido (análise).
 * O ticket é APAGADO e um aviso é criado em `garantia_rejeicoes` com o motivo,
 * disponível por 48h para o vendedor reabrir.
 */
export async function rejeitarGarantia(
  id: number,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requirePermission("gerenciar_garantia")
    const motivoLimpo = clean(motivo)
    if (!motivoLimpo) return { ok: false, error: "Informe o motivo da rejeição." }
    const g = await getGarantia(id)
    if (!g) return { ok: false, error: "Garantia não encontrada." }

    const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000)

    await db.transaction(async (tx) => {
      await tx.insert(garantiaRejeicoes).values({
        vendedorId: g.vendedorId,
        protocolo: g.protocolo,
        produtoDescricao: g.produtoDescricao,
        clienteNome: g.clienteNome,
        motivo: motivoLimpo,
        etapa: g.status,
        dadosOriginais: g,
        expiraEm,
      })
      await tx.delete(garantias).where(eq(garantias.id, id))
    })

    await registrarLog({
      actor,
      area: "garantias",
      acao: "rejeitou",
      detalhe: `Rejeitou a garantia ${g.protocolo} (motivo: ${motivoLimpo}). Ticket removido; aviso disponível 48h para o vendedor.`,
    })
    revalidatePath("/estoque/garantia")
    revalidatePath("/garantias")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao rejeitar garantia." }
  }
}

/** Equipe interna registra análise técnica / resultado / observação. */
export async function atualizarAnaliseGarantia(
  id: number,
  input: { analiseTecnica?: string; resultado?: string | null; observacaoInterna?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requirePermission("gerenciar_garantia")
    const resultado = clean(input.resultado)
    if (resultado && resultado !== "aprovado" && resultado !== "reprovado") {
      return { ok: false, error: "Resultado inválido." }
    }
    await db
      .update(garantias)
      .set({
        analiseTecnica: clean(input.analiseTecnica),
        resultado,
        observacaoInterna: clean(input.observacaoInterna),
        updatedAt: new Date(),
      })
      .where(eq(garantias.id, id))
    const [g] = await db.select({ protocolo: garantias.protocolo }).from(garantias).where(eq(garantias.id, id)).limit(1)
    await registrarLog({
      actor,
      area: "garantias",
      acao: "analise",
      detalhe: `Registrou análise na garantia ${g?.protocolo ?? `#${id}`}${
        resultado ? ` — resultado: ${resultado.toUpperCase()}` : ""
      }.`,
    })
    revalidatePath("/estoque/garantia")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar análise." }
  }
}
