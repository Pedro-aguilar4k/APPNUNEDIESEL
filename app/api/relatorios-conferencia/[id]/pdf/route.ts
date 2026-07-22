import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { db } from "@/lib/db"
import { relatoriosConferencia } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireAnyPermission } from "@/lib/guards"
import type { RelatorioDados } from "@/app/actions/relatorio-conferencia"

// Paleta (aproxima os tokens de marca da plataforma).
const NAVY = rgb(0.09, 0.11, 0.4)
const NAVY_SOFT = rgb(0.93, 0.94, 0.99)
const GREEN = rgb(0.09, 0.53, 0.32)
const GREEN_SOFT = rgb(0.9, 0.96, 0.92)
const RED = rgb(0.78, 0.16, 0.16)
const RED_SOFT = rgb(0.99, 0.92, 0.92)
const MUTED = rgb(0.42, 0.45, 0.52)
const BORDER = rgb(0.84, 0.86, 0.9)
const ZEBRA = rgb(0.97, 0.975, 0.99)
const WHITE = rgb(1, 1, 1)
const DARK = rgb(0.1, 0.12, 0.16)

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40

// Colunas da tabela (x inicial de cada coluna, dentro da área útil).
const COL = {
  codOrig: 40,
  codInt: 115,
  desc: 190,
  nf: 410,
  conf: 452,
  sit: 500,
  end: 555,
}

// Substitui caracteres fora do WinAnsi (raros) para não quebrar o embed.
function safe(s: string): string {
  return (s ?? "").replace(/[^\x00-\xFF]/g, "?")
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let t = safe(text)
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxWidth) {
    t = t.slice(0, -1)
  }
  return t + "…"
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission("conferir", "relatorios")
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { id } = await params
  const relId = Number(id)
  if (!Number.isFinite(relId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const [rel] = await db.select().from(relatoriosConferencia).where(eq(relatoriosConferencia.id, relId)).limit(1)
  if (!rel) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 })

  const dados = rel.dadosJson as RelatorioDados | null

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  if (dados && Array.isArray(dados.itens)) {
    renderBonito(pdf, font, bold, dados)
  } else {
    renderLegado(pdf, await pdf.embedFont(StandardFonts.Courier), rel.conteudoTxt)
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

function renderBonito(pdf: PDFDocument, font: PDFFont, bold: PDFFont, d: RelatorioDados) {
  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H

  // ---- Cabeçalho (faixa navy) ----
  const headerH = 74
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: NAVY })
  page.drawText(safe(d.empresa), { x: MARGIN, y: PAGE_H - 32, size: 15, font: bold, color: WHITE })
  page.drawText("Relatório de Conferência de Mercadoria", {
    x: MARGIN,
    y: PAGE_H - 52,
    size: 10,
    font,
    color: rgb(0.8, 0.83, 0.95),
  })

  // Selo de status (canto direito do cabeçalho).
  const conferida = d.status === "conferida"
  const selo = conferida ? "CONFERIDA" : "DIVERGENTE"
  const seloW = bold.widthOfTextAtSize(selo, 10) + 22
  page.drawRectangle({
    x: PAGE_W - MARGIN - seloW,
    y: PAGE_H - 47,
    width: seloW,
    height: 20,
    color: conferida ? GREEN : RED,
  })
  page.drawText(selo, {
    x: PAGE_W - MARGIN - seloW + 11,
    y: PAGE_H - 41,
    size: 10,
    font: bold,
    color: WHITE,
  })

  y = PAGE_H - headerH - 24

  // ---- Bloco de informações ----
  const col1 = MARGIN
  const col2 = PAGE_W / 2 + 10
  const info = (x: number, yy: number, label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x, y: yy, size: 7.5, font: bold, color: MUTED })
    page.drawText(truncate(value, font, 10, PAGE_W / 2 - MARGIN - 20), {
      x,
      y: yy - 12,
      size: 10,
      font,
      color: DARK,
    })
  }

  const serieTxt = d.nota.serie ? `${d.nota.numero}  ·  Série ${d.nota.serie}` : d.nota.numero
  info(col1, y, "Nota fiscal", serieTxt)
  info(col2, y, "Emissão", d.nota.emissao)
  y -= 34
  info(col1, y, "Fornecedor", d.nota.fornecedor)
  info(col2, y, "CNPJ", d.nota.cnpj || "—")
  y -= 34
  info(col1, y, "Estoquista", d.estoquista)
  info(col2, y, "Conferido por", d.conferentePor)
  y -= 34
  info(col1, y, "Gerado em", d.geradoEm)
  info(col2, y, "Chave de acesso", d.nota.chave || "—")
  y -= 30

  // Régua divisória.
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: BORDER })
  y -= 24

  // ---- Cabeçalho da tabela ----
  const drawTableHeader = (yy: number): number => {
    page.drawRectangle({ x: MARGIN, y: yy - 6, width: COL.end - MARGIN, height: 22, color: NAVY_SOFT })
    const th = (t: string, x: number, right?: number) => {
      const size = 8
      const w = bold.widthOfTextAtSize(t, size)
      page.drawText(t, { x: right != null ? right - w : x, y: yy, size, font: bold, color: NAVY })
    }
    th("CÓD. ORIG.", COL.codOrig + 4)
    th("CÓD. INT.", COL.codInt + 4)
    th("DESCRIÇÃO", COL.desc + 4)
    th("NF", 0, COL.conf - 6)
    th("CONF.", 0, COL.sit - 6)
    th("SITUAÇÃO", COL.sit + 2)
    return yy - 22
  }
  y = drawTableHeader(y)

  // ---- Linhas ----
  const rowH = 20
  let zebra = false
  for (const it of d.itens) {
    if (y < MARGIN + 90) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN - 10
      y = drawTableHeader(y)
      zebra = false
    }
    if (zebra) {
      page.drawRectangle({ x: MARGIN, y: y - 5, width: COL.end - MARGIN, height: rowH, color: ZEBRA })
    }
    zebra = !zebra

    page.drawText(truncate(it.codigoOriginal, font, 8.5, COL.codInt - COL.codOrig - 8), {
      x: COL.codOrig + 4,
      y,
      size: 8.5,
      font,
      color: DARK,
    })
    page.drawText(truncate(it.codigoInterno, bold, 8.5, COL.desc - COL.codInt - 8), {
      x: COL.codInt + 4,
      y,
      size: 8.5,
      font: bold,
      color: NAVY,
    })
    const descLine = it.ean && it.ean !== "-" ? `${it.descricao}` : it.descricao
    page.drawText(truncate(descLine, font, 8.5, COL.nf - COL.desc - 10), {
      x: COL.desc + 4,
      y: y + (it.ean && it.ean !== "-" ? 3 : 0),
      size: 8.5,
      font,
      color: DARK,
    })
    if (it.ean && it.ean !== "-") {
      page.drawText(truncate(`EAN ${it.ean}`, font, 7, COL.nf - COL.desc - 10), {
        x: COL.desc + 4,
        y: y - 6,
        size: 7,
        font,
        color: MUTED,
      })
    }
    const nfTxt = `${it.quantidade}${it.unidade ? " " + it.unidade : ""}`
    const confTxt = `${it.quantidadeConferida}${it.unidade ? " " + it.unidade : ""}`
    page.drawText(nfTxt, { x: COL.conf - 6 - font.widthOfTextAtSize(nfTxt, 8.5), y, size: 8.5, font, color: DARK })
    page.drawText(confTxt, {
      x: COL.sit - 6 - font.widthOfTextAtSize(confTxt, 8.5),
      y,
      size: 8.5,
      font,
      color: DARK,
    })

    // Situação como pílula colorida.
    const sit = it.ok ? "OK" : "DIVERG."
    const sw = bold.widthOfTextAtSize(sit, 7.5) + 12
    page.drawRectangle({
      x: COL.sit + 2,
      y: y - 3,
      width: sw,
      height: 14,
      color: it.ok ? GREEN_SOFT : RED_SOFT,
    })
    page.drawText(sit, { x: COL.sit + 8, y: y + 0.5, size: 7.5, font: bold, color: it.ok ? GREEN : RED })

    y -= rowH
  }

  // ---- Totais ----
  y -= 6
  page.drawLine({ start: { x: MARGIN, y }, end: { x: COL.end, y }, thickness: 1, color: BORDER })
  y -= 20
  const chip = (x: number, label: string, valor: string, cor = DARK) => {
    page.drawText(label, { x, y, size: 8, font, color: MUTED })
    page.drawText(valor, { x, y: y - 13, size: 13, font: bold, color: cor })
  }
  chip(MARGIN, "Total de itens", String(d.totais.total))
  chip(MARGIN + 130, "Conferidos OK", String(d.totais.conferidos), GREEN)
  chip(MARGIN + 260, "Divergentes", String(d.totais.divergentes), d.totais.divergentes > 0 ? RED : DARK)
  y -= 52

  // ---- Assinaturas ----
  if (y < MARGIN + 60) {
    page = pdf.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN - 40
  }
  const sigW = (COL.end - MARGIN - 30) / 2
  const sigY = y
  page.drawLine({ start: { x: MARGIN, y: sigY }, end: { x: MARGIN + sigW, y: sigY }, thickness: 0.8, color: DARK })
  page.drawText("Assinatura do estoquista", { x: MARGIN, y: sigY - 12, size: 8, font, color: MUTED })
  page.drawLine({
    start: { x: MARGIN + sigW + 30, y: sigY },
    end: { x: COL.end, y: sigY },
    thickness: 0.8,
    color: DARK,
  })
  page.drawText("Assinatura do conferente", { x: MARGIN + sigW + 30, y: sigY - 12, size: 8, font, color: MUTED })

  // Rodapé em todas as páginas.
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawText(`Nune Diesel · Conferência de NF-e · Página ${i + 1} de ${pages.length}`, {
      x: MARGIN,
      y: 24,
      size: 7.5,
      font,
      color: MUTED,
    })
  })
}

// Fallback: relatórios antigos sem dados estruturados (renderiza o TXT).
function renderLegado(pdf: PDFDocument, courier: PDFFont, txt: string) {
  const fontSize = 9
  const lineHeight = 12
  const linesPerPage = Math.floor((PAGE_H - MARGIN * 2) / lineHeight)
  const lines = txt
    .replace(/\r/g, "")
    .split("\n")
    .map((l) =>
      l.replace(/[^\x20-\x7E]/g, (c) => {
        const map: Record<string, string> = {
          ç: "c", Ç: "C", ã: "a", á: "a", à: "a", â: "a", é: "e", ê: "e", í: "i", ó: "o", ô: "o", õ: "o", ú: "u",
        }
        return map[c] ?? "?"
      }),
    )
  let page = pdf.addPage([PAGE_W, PAGE_H])
  let cursor = PAGE_H - MARGIN
  let count = 0
  for (const line of lines) {
    if (count >= linesPerPage) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      cursor = PAGE_H - MARGIN
      count = 0
    }
    page.drawText(line, { x: MARGIN, y: cursor, size: fontSize, font: courier, color: NAVY })
    cursor -= lineHeight
    count++
  }
}
