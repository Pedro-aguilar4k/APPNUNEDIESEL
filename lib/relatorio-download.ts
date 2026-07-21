import { toast } from "sonner"

// Busca o documento via fetch autenticado (mantém o cookie de sessão do
// contexto atual). Necessário porque abrir uma nova aba de nível superior
// no preview em iframe não envia o cookie particionado, resultando em 401.
async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { credentials: "include" })
    if (!res.ok) {
      toast.error(res.status === 401 ? "Sessão expirada. Faça login novamente." : "Não foi possível gerar o documento.")
      return null
    }
    return await res.blob()
  } catch {
    toast.error("Falha ao baixar o documento.")
    return null
  }
}

/** Baixa o arquivo .txt do relatório. */
export async function baixarRelatorioTxt(id: number, numeroNota?: string | null) {
  const blob = await fetchBlob(`/api/relatorios-conferencia/${id}/txt`)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `relatorio-conferencia-${numeroNota ?? id}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Abre o PDF de impressão do relatório em uma nova aba. */
export async function abrirRelatorioPdf(id: number) {
  const blob = await fetchBlob(`/api/relatorios-conferencia/${id}/pdf`)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  // Fallback: se o navegador bloquear a nova aba, baixa o arquivo.
  if (!win) {
    const a = document.createElement("a")
    a.href = url
    a.download = `relatorio-conferencia-${id}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
