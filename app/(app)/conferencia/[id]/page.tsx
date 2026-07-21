import { redirect } from "next/navigation"

// Conferência foi movida para a seção Estoque.
export default async function ConferenciaDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/estoque/conferencia/${id}`)
}
