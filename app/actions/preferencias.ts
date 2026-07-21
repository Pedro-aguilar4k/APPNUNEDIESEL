"use server"

import { db } from "@/lib/db"
import { preferenciasUsuario } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getUserId } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { PREFERENCIAS_PADRAO, type PreferenciasInput } from "@/lib/preferencias"

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
    notifEstoqueBaixo: row.notifEstoqueBaixo,
    notifNovaGarantia: row.notifNovaGarantia,
    notifResumoDiario: row.notifResumoDiario,
  }
}

/** Salva (upsert) as preferências do usuário atual. */
export async function savePreferencias(input: PreferenciasInput): Promise<SaveResult> {
  try {
    const userId = await getUserId()

    const values = {
      userId,
      notifEstoqueBaixo: input.notifEstoqueBaixo,
      notifNovaGarantia: input.notifNovaGarantia,
      notifResumoDiario: input.notifResumoDiario,
      updatedAt: new Date(),
    }

    await db
      .insert(preferenciasUsuario)
      .values(values)
      .onConflictDoUpdate({
        target: preferenciasUsuario.userId,
        set: {
          notifEstoqueBaixo: values.notifEstoqueBaixo,
          notifNovaGarantia: values.notifNovaGarantia,
          notifResumoDiario: values.notifResumoDiario,
          updatedAt: values.updatedAt,
        },
      })

    revalidatePath("/configuracoes")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar preferências." }
  }
}
