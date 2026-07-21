"use server"

import { db } from "@/lib/db"
import { garantias } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"
import { revalidatePath } from "next/cache"

export const GARANTIA_STATUS = ["pendente", "em_analise", "enviado", "esperando_retorno"] as const
export type GarantiaStatus = (typeof GARANTIA_STATUS)[number]

export const GARANTIA_STATUS_LABELS: Record<GarantiaStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  enviado: "Enviado",
  esperando_retorno: "Esperando retorno",
}

export type Garantia = typeof garantias.$inferSelect

export type NovaGarantiaInput = {
  // Cliente
  clienteNome: string
  clienteContato?: string
  clienteFone?: string
  clienteEmail?: string
  notaNumero?: string
  dataCompra?: string
  loja?: string
  // Produto
  pecaNumero?: string
  produtoDescricao: string
  pecaMarca?: string
  veiculo?: string
  anoModelo?: string
  motor?: string
  // Uso
  kmInicial?: string
  kmDefeito?: string
  kmRodado?: string
  horasRodadas?: string
  dataAplicacao?: string
  dataDefeito?: string
  // Defeito
  descricaoDefeito: string
}

export type GarantiaResult = { ok: true; protocolo: string } | { ok: false; error: string }

function clean(v?: string | null): string | null {
  const t = (v ?? "").trim()
  return t.length ? t : null
}

/** Gera um protocolo sequencial legível: GAR-000123. */
async function gerarProtocolo(): Promise<string> {
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${garantias.id}), 0)` })
    .from(garantias)
  const proximo = Number(max) + 1
  return `GAR-${String(proximo).padStart(6, "0")}`
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

    const protocolo = await gerarProtocolo()

    await db.insert(garantias).values({
      protocolo,
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

/** Lista todas as garantias (board interno da equipe). */
export async function listGarantias(): Promise<Garantia[]> {
  await requirePermission("gerenciar_garantia")
  return db.select().from(garantias).orderBy(desc(garantias.createdAt))
}

/** Equipe interna move o ticket entre os status. */
export async function atualizarStatusGarantia(
  id: number,
  status: GarantiaStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("gerenciar_garantia")
    if (!GARANTIA_STATUS.includes(status)) return { ok: false, error: "Status inválido." }
    await db.update(garantias).set({ status, updatedAt: new Date() }).where(eq(garantias.id, id))
    revalidatePath("/estoque/garantia")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar status." }
  }
}

/** Equipe interna registra análise técnica / resultado / observação. */
export async function atualizarAnaliseGarantia(
  id: number,
  input: { analiseTecnica?: string; resultado?: string | null; observacaoInterna?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("gerenciar_garantia")
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
    revalidatePath("/estoque/garantia")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar análise." }
  }
}
