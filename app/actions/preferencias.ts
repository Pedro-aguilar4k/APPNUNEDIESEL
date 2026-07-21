"use server"

import { db } from "@/lib/db"
import { preferenciasUsuario } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getUserId } from "@/lib/session"
import { revalidatePath } from "next/cache"
import {
  PREFERENCIAS_PADRAO,
  type Preferencias,
  type PreferenciasInput,
} from "@/lib/preferencias"

type SaveResult = { ok: true } | { ok: false; error: string }

/** Carrega as preferências do usuário atual, preenchendo com os padrões. */
export async function getPreferencias(): Promise<PreferenciasInput> {
  const userId = await getUserId()
  const [row] = await db
    .select()
    .from(preferenciasUsuario)
    .where(eq(preferenciasUsuario.userId, userId))
    .limit(1)

  if (!row) return { ...PREFERENCIAS_PADRAO }

  return {
    itensPorPagina: row.itensPorPagina,
    notifEstoqueBaixo: row.notifEstoqueBaixo,
    notifNovaGarantia: row.notifNovaGarantia,
    notifResumoDiario: row.notifResumoDiario,
    estoqueAlertaMinimo: row.estoqueAlertaMinimo,
    esperaTipoPadrao: row.esperaTipoPadrao,
    garantiaLojaPadrao: row.garantiaLojaPadrao,
  }
}

/** Salva (upsert) as preferências do usuário atual. */
export async function savePreferencias(input: PreferenciasInput): Promise<SaveResult> {
  try {
    const userId = await getUserId()

    // Sanitização básica dos numéricos.
    const itensPorPagina = clamp(Math.trunc(input.itensPorPagina), 1, 500)
    const estoqueAlertaMinimo = clamp(Math.trunc(input.estoqueAlertaMinimo), 0, 100000)
    const esperaTipoPadrao = ["unidade", "pacote", "caixa"].includes(input.esperaTipoPadrao)
      ? input.esperaTipoPadrao
      : "unidade"
    const garantiaLojaPadrao = input.garantiaLojaPadrao?.trim() || null

    const values = {
      userId,
      itensPorPagina,
      notifEstoqueBaixo: input.notifEstoqueBaixo,
      notifNovaGarantia: input.notifNovaGarantia,
      notifResumoDiario: input.notifResumoDiario,
      estoqueAlertaMinimo,
      esperaTipoPadrao,
      garantiaLojaPadrao,
      updatedAt: new Date(),
    } satisfies Partial<Preferencias>

    await db
      .insert(preferenciasUsuario)
      .values(values)
      .onConflictDoUpdate({
        target: preferenciasUsuario.userId,
        set: {
          itensPorPagina: values.itensPorPagina,
          notifEstoqueBaixo: values.notifEstoqueBaixo,
          notifNovaGarantia: values.notifNovaGarantia,
          notifResumoDiario: values.notifResumoDiario,
          estoqueAlertaMinimo: values.estoqueAlertaMinimo,
          esperaTipoPadrao: values.esperaTipoPadrao,
          garantiaLojaPadrao: values.garantiaLojaPadrao,
          updatedAt: values.updatedAt,
        },
      })

    revalidatePath("/configuracoes")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar preferências." }
  }
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}
