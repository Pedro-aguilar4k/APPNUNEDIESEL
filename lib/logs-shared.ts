import type { logs } from "@/lib/db/schema"

// Tipos e rótulos SEGUROS para o cliente (sem importar o driver do banco).
export const LOG_AREAS = [
  "importacao",
  "conferencia",
  "espera",
  "garantias",
  "produtos",
  "fornecedores",
  "equivalencias",
  "usuarios",
] as const

export type LogArea = (typeof LOG_AREAS)[number]

export const LOG_AREA_LABELS: Record<LogArea, string> = {
  importacao: "Importação",
  conferencia: "Conferência",
  espera: "Espera",
  garantias: "Garantias",
  produtos: "Produtos",
  fornecedores: "Fornecedores",
  equivalencias: "Equivalências",
  usuarios: "Usuários",
}

export type LogRow = typeof logs.$inferSelect
