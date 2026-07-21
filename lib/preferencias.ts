import type { preferenciasUsuario } from "@/lib/db/schema"

export type Preferencias = typeof preferenciasUsuario.$inferSelect

/** Campos editáveis pelo usuário na tela de Configurações. */
export type PreferenciasInput = {
  itensPorPagina: number
  notifEstoqueBaixo: boolean
  notifNovaGarantia: boolean
  notifResumoDiario: boolean
  estoqueAlertaMinimo: number
  esperaTipoPadrao: string
  garantiaLojaPadrao: string | null
}

/** Valores padrão aplicados quando o usuário ainda não salvou preferências. */
export const PREFERENCIAS_PADRAO: PreferenciasInput = {
  itensPorPagina: 25,
  notifEstoqueBaixo: true,
  notifNovaGarantia: true,
  notifResumoDiario: false,
  estoqueAlertaMinimo: 5,
  esperaTipoPadrao: "unidade",
  garantiaLojaPadrao: null,
}

export const ITENS_POR_PAGINA_OPCOES = [10, 25, 50, 100] as const

export const LOJAS = ["Sama", "Laguna", "Matrix"] as const
