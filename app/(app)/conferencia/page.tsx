import { redirect } from "next/navigation"

// Conferência foi movida para a seção Estoque.
export default function ConferenciaRedirect() {
  redirect("/estoque/conferencia")
}
