import { db } from "@/lib/db"
import { logs } from "@/lib/db/schema"
import { type LogArea } from "@/lib/logs-shared"

// Re-exporta os tipos/labels compartilhados para uso no servidor.
export { LOG_AREAS, LOG_AREA_LABELS, type LogArea, type LogRow } from "@/lib/logs-shared"

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
