import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { db } from "@/lib/db"
import { relatoriosConferencia } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireAnyPermission } from "@/lib/guards"

// Reconstrói o PDF de impressão a partir do TXT salvo (fonte de verdade).
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

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Courier)

  const fontSize = 9
  const lineHeight = 12
  const margin = 40
  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const usableHeight = pageHeight - margin * 2
  const linesPerPage = Math.floor(usableHeight / lineHeight)

  // Normaliza caracteres não suportados pelas fontes padrão (WinAnsi).
  const lines = rel.conteudoTxt
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[^\x20-\x7E]/g, (c) => {
      const map: Record<string, string> = { "ç": "c", "Ç": "C", "ã": "a", "á": "a", "à": "a", "â": "a", "é": "e", "ê": "e", "í": "i", "ó": "o", "ô": "o", "õ": "o", "ú": "u" }
      return map[c] ?? "?"
    }))

  let page = pdf.addPage([pageWidth, pageHeight])
  let cursor = pageHeight - margin
  let count = 0

  for (const line of lines) {
    if (count >= linesPerPage) {
      page = pdf.addPage([pageWidth, pageHeight])
      cursor = pageHeight - margin
      count = 0
    }
    page.drawText(line, {
      x: margin,
      y: cursor,
      size: fontSize,
      font,
      color: rgb(0.08, 0.1, 0.38),
    })
    cursor -= lineHeight
    count++
  }

  const bytes = await pdf.save()
  const nome = `relatorio-conferencia-nota-${rel.numeroNota ?? rel.notaId}-${rel.id}.pdf`

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  })
}
