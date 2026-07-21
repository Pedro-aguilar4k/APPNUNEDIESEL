import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { relatoriosConferencia } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireAnyPermission } from "@/lib/guards"

// Entrega o arquivo .txt salvo (fonte de verdade do relatório).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission("conferir", "relatorios")
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { id } = await params
  const relId = Number(id)
  if (!Number.isFinite(relId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const [rel] = await db
    .select()
    .from(relatoriosConferencia)
    .where(eq(relatoriosConferencia.id, relId))
    .limit(1)
  if (!rel) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 })

  const nome = `relatorio-conferencia-nota-${rel.numeroNota ?? rel.notaId}-${rel.id}.txt`

  return new NextResponse(rel.conteudoTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  })
}
