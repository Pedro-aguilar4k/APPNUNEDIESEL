import type { garantias, garantiaRejeicoes } from "@/lib/db/schema"

// Status do fluxo de garantia. A ordem aqui define a ordem das colunas do board.
export const GARANTIA_STATUS = [
  "pendente",
  "em_analise",
  "enviado",
  "esperando_retorno",
  "concluido",
] as const
export type GarantiaStatus = (typeof GARANTIA_STATUS)[number]

export const GARANTIA_STATUS_LABELS: Record<GarantiaStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  enviado: "Enviado",
  esperando_retorno: "Esperando retorno",
  concluido: "Concluído",
}

// Quem paga o frete no envio da garantia.
export const FRETE_CONTA = ["destinatario", "remetente"] as const
export type FreteConta = (typeof FRETE_CONTA)[number]
export const FRETE_CONTA_LABELS: Record<FreteConta, string> = {
  destinatario: "Por conta do destinatário",
  remetente: "Por conta do remetente",
}

// Resultado do retorno da garantia.
export const PROCEDENCIA = ["procedente", "improcedente"] as const
export type Procedencia = (typeof PROCEDENCIA)[number]
export const PROCEDENCIA_LABELS: Record<Procedencia, string> = {
  procedente: "Procedente",
  improcedente: "Improcedente",
}

// Como o valor/peça retorna ao cliente.
export const TIPO_RETORNO = ["credito", "peca_nova", "desconto"] as const
export type TipoRetorno = (typeof TIPO_RETORNO)[number]
export const TIPO_RETORNO_LABELS: Record<TipoRetorno, string> = {
  credito: "Crédito",
  peca_nova: "Peça nova",
  desconto: "Desconto na próxima compra",
}

export type Garantia = typeof garantias.$inferSelect
export type GarantiaRejeicao = typeof garantiaRejeicoes.$inferSelect

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
