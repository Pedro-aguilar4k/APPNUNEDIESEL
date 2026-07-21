import type { preferenciasUsuario } from "@/lib/db/schema"

export type Preferencias = typeof preferenciasUsuario.$inferSelect

/** Campos editáveis pelo usuário na tela de Configurações (notificações do painel). */
export type PreferenciasInput = {
  notifEstoqueBaixo: boolean
  notifNovaGarantia: boolean
  notifResumoDiario: boolean
}

/** Valores padrão aplicados quando o usuário ainda não salvou preferências. */
export const PREFERENCIAS_PADRAO: PreferenciasInput = {
  notifEstoqueBaixo: true,
  notifNovaGarantia: true,
  notifResumoDiario: false,
}
