import type { garantias } from "@/lib/db/schema"

// Status do fluxo de garantia. A ordem aqui define a ordem das colunas do board.
export const GARANTIA_STATUS = ["pendente", "em_analise", "enviado", "esperando_retorno"] as const
export type GarantiaStatus = (typeof GARANTIA_STATUS)[number]

export const GARANTIA_STATUS_LABELS: Record<GarantiaStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  enviado: "Enviado",
  esperando_retorno: "Esperando retorno",
}

export type Garantia = typeof garantias.$inferSelect

export type NovaGarantiaInput = {
  // Cliente
  clienteNome: string
  clienteContato?: string
  clienteFone?: string
  clienteEmail?: string
  notaNumero?: string
  dataCompra?: string
  loja?: string
  // Produto
  pecaNumero?: string
  produtoDescricao: string
  pecaMarca?: string
  veiculo?: string
  anoModelo?: string
  motor?: string
  // Uso
  kmInicial?: string
  kmDefeito?: string
  kmRodado?: string
  horasRodadas?: string
  dataAplicacao?: string
  dataDefeito?: string
  // Defeito
  descricaoDefeito: string
}
