import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { requireAnyPermission } from "@/lib/guards"
import { getAuditoria, getResumo, type ItemRelatorio, type StatusItem } from "@/app/actions/auditoria"

const NAVY = rgb(0.09, 0.11, 0.4)
const NAVY_SOFT = rgb(0.93, 0.94, 0.99)
const GREEN = rgb(0.09, 0.53, 0.32)
const AMBER = rgb(0.72, 0.5, 0.05)
const RED = rgb(0.78, 0.16, 0.16)
const MUTED = rgb(0.42, 0.45, 0.52)
const BORDER = rgb(0.84, 0.86, 0.9)
const ZEBRA = rgb(0.97, 0.975, 0.99)
const WHITE = rgb(1, 1, 1)
const DARK = rgb(0.1, 0.12, 0.16)

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40

const COL = { cod: 40, desc: 130, sis: 320, con: 370, dif: 420, sit: 470, end: 555 }

const STATUS_LABEL: Record<StatusItem, string> = {
  correto: "Correto",
  sobra: "Sobra",
  falta: "Falta",
  sem_cadastro: "Sem cadastro",
  nao_encontrado: "Nao encontrado",
}

function statusColor(status: StatusItem) {
  if (status === "correto") return GREEN
  if (status === "sobra") return AMBER
  return RED
}

function safe(s: string): string {
  return (s ?? "").replace(/[^\x00-\xFF]/g, "?")
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let t = safe(text)
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxWidth) t = t.slice(0, -1)
  return t + "..."
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission("conferir", "relatorios")
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { id } = await params
  const audId = Number(id)
  if (!Number.isFinite(audId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const dados = await getAuditoria(audId)
  const resumo = await getResumo(audId)
  if (!dados || !resumo) return NextResponse.json({ error: "Auditoria não encontrada" }, { status: 404 })

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  render(pdf, font, bold, dados.auditoria.nome, dados.auditoria.createdByNome ?? "—", resumo)

  const bytes = await pdf.save()
  const nome = `auditoria-${audId}.pdf`
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  })
}

function render(
  pdf: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  nome: string,
  responsavel: string,
  resumo: Awaited<ReturnType<typeof getResumo>> & object,
) {
  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H

  // Cabeçalho.
  const headerH = 74
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: NAVY })
  page.drawText("Nune Diesel", { x: MARGIN, y: PAGE_H - 32, size: 15, font: bold, color: WHITE })
  page.drawText("Relatório de Auditoria de Estoque", { x: MARGIN, y: PAGE_H - 52, size: 10, font, color: rgb(0.8, 0.83, 0.95) })

  y = PAGE_H - headerH - 24

  const info = (x: number, yy: number, label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x, y: yy, size: 7.5, font: bold, color: MUTED })
    page.drawText(truncate(value, font, 10, PAGE_W / 2 - MARGIN - 20), { x, y: yy - 12, size: 10, font, color: DARK })
  }
  info(MARGIN, y, "Auditoria", nome)
  info(PAGE_W / 2 + 10, y, "Responsável", responsavel)
  y -= 34
  info(MARGIN, y, "Gerado em", new Date().toLocaleString("pt-BR"))
  info(PAGE_W / 2 + 10, y, "Progresso", `${resumo.percentualConcluido}%`)
  y -= 30

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: BORDER })
  y -= 22

  // Chips de resumo.
  const chip = (x: number, label: string, valor: number, cor = DARK) => {
    page.drawText(label, { x, y, size: 7.5, font, color: MUTED })
    page.drawText(String(valor), { x, y: y - 13, size: 13, font: bold, color: cor })
  }
  chip(MARGIN, "Importados", resumo.totalImportados)
  chip(MARGIN + 90, "Conferidos", resumo.totalConferidos)
  chip(MARGIN + 180, "Corretos", resumo.corretos, GREEN)
  chip(MARGIN + 260, "Faltas", resumo.faltas, RED)
  chip(MARGIN + 330, "Sobras", resumo.sobras, AMBER)
  chip(MARGIN + 410, "Divergências", resumo.totalDivergencias, resumo.totalDivergencias > 0 ? RED : DARK)
  y -= 40

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: BORDER })
  y -= 20

  // Cabeçalho da tabela.
  const drawTableHeader = (yy: number): number => {
    page.drawRectangle({ x: MARGIN, y: yy - 6, width: COL.end - MARGIN, height: 22, color: NAVY_SOFT })
    const th = (t: string, x: number, right?: number) => {
      const w = bold.widthOfTextAtSize(t, 8)
      page.drawText(t, { x: right != null ? right - w : x, y: yy, size: 8, font: bold, color: NAVY })
    }
    th("CODIGO", COL.cod + 4)
    th("DESCRICAO", COL.desc + 4)
    th("SIS.", 0, COL.con - 6)
    th("CON.", 0, COL.dif - 6)
    th("DIF.", 0, COL.sit - 6)
    th("SITUACAO", COL.sit + 2)
    return yy - 22
  }
  y = drawTableHeader(y)

  const rowH = 18
  let zebra = false
  // Ordena: divergências primeiro para leitura rápida.
  const ordem: Record<StatusItem, number> = { falta: 0, sobra: 1, nao_encontrado: 2, sem_cadastro: 3, correto: 4 }
  const itens = [...resumo.itens].sort((a, b) => ordem[a.status] - ordem[b.status] || a.codigo.localeCompare(b.codigo))

  for (const it of itens) {
    if (y < MARGIN + 40) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN - 10
      y = drawTableHeader(y)
      zebra = false
    }
    if (zebra) page.drawRectangle({ x: MARGIN, y: y - 5, width: COL.end - MARGIN, height: rowH, color: ZEBRA })
    zebra = !zebra

    page.drawText(truncate(it.codigo, bold, 8, COL.desc - COL.cod - 8), { x: COL.cod + 4, y, size: 8, font: bold, color: NAVY })
    const descComLoc = it.multiplasLocalizacoes ? `${it.descricao ?? ""}  [multiplas loc.]` : (it.descricao ?? "")
    page.drawText(truncate(descComLoc, font, 8, COL.sis - COL.desc - 10), { x: COL.desc + 4, y, size: 8, font, color: DARK })
    page.drawText(String(it.quantidadeSistema), { x: COL.con - 6 - font.widthOfTextAtSize(String(it.quantidadeSistema), 8), y, size: 8, font, color: DARK })
    page.drawText(String(it.quantidadeContada), { x: COL.dif - 6 - font.widthOfTextAtSize(String(it.quantidadeContada), 8), y, size: 8, font, color: DARK })
    const dif = it.diferenca > 0 ? `+${it.diferenca}` : String(it.diferenca)
    page.drawText(dif, { x: COL.sit - 6 - font.widthOfTextAtSize(dif, 8), y, size: 8, font: bold, color: it.diferenca === 0 ? MUTED : statusColor(it.status) })
    page.drawText(STATUS_LABEL[it.status], { x: COL.sit + 2, y, size: 7.5, font: bold, color: statusColor(it.status) })

    y -= rowH
  }

  // Rodapé.
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawText(`Nune Diesel - Auditoria de Estoque - Pagina ${i + 1} de ${pages.length}`, { x: MARGIN, y: 24, size: 7.5, font, color: MUTED })
  })
}
