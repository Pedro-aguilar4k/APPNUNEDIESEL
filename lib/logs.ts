import { db } from "@/lib/db"
import { logs } from "@/lib/db/schema"

export const LOG_AREAS = [
  "importacao",
  "conferencia",
  "espera",
  "garantias",
  "produtos",
  "fornecedores",
  "equivalencias",
  "usuarios",
] as const

export type LogArea = (typeof LOG_AREAS)[number]

export const LOG_AREA_LABELS: Record<LogArea, string> = {
  importacao: "Importação",
  conferencia: "Conferência",
  espera: "Espera",
  garantias: "Garantias",
  produtos: "Produtos",
  fornecedores: "Fornecedores",
  equivalencias: "Equivalências",
  usuarios: "Usuários",
}

export type LogRow = typeof logs.$inferSelect

/**
 * Registra uma entrada no log de auditoria. É "fire-and-forget": qualquer falha
 * é engolida (apenas logada no console) para NUNCA quebrar a ação principal.
 */
export async function registrarLog(entry: {
  actor?: { id: string; name: string } | null
  area: LogArea
  acao: string
  detalhe: string
}): Promise<void> {
  try {
    await db.insert(logs).values({
      actorId: entry.actor?.id ?? null,
      actorNome: entry.actor?.name ?? "Sistema",
      area: entry.area,
      acao: entry.acao,
      detalhe: entry.detalhe,
    })
  } catch (e) {
    console.error("[v0] falha ao registrar log:", e instanceof Error ? e.message : e)
  }
}
