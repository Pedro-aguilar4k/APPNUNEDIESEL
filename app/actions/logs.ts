"use server"

import { db } from "@/lib/db"
import { logs } from "@/lib/db/schema"
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm"
import { requirePermission } from "@/lib/guards"
import { LOG_AREAS, type LogArea, type LogRow } from "@/lib/logs-shared"

/**
 * Lista o histórico de auditoria (mais recentes primeiro). Restrito a quem tem
 * a permissão ver_logs (admin e gerente). Filtra por área e/ou texto livre
 * (busca no nome de quem fez e no detalhe).
 */
export async function listLogs(params?: { area?: string; q?: string }): Promise<LogRow[]> {
  await requirePermission("ver_logs")

  const conditions: SQL[] = []

  const area = params?.area?.trim()
  if (area && area !== "todos" && LOG_AREAS.includes(area as LogArea)) {
    conditions.push(eq(logs.area, area))
  }

  const q = params?.q?.trim()
  if (q) {
    conditions.push(or(ilike(logs.detalhe, `%${q}%`), ilike(logs.actorNome, `%${q}%`))!)
  }

  return db
    .select()
    .from(logs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(logs.createdAt))
    .limit(300)
}
