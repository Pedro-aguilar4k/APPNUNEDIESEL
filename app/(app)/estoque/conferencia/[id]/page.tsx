import { requireUser } from "@/lib/session"
import { redirect, notFound } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { getConferencia } from "@/app/actions/conferencia"
import { ConferenciaScanner } from "@/components/conferencia/conferencia-scanner"

export default async function ConferenciaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "conferir")) redirect("/")

  const { id } = await params
  const notaId = Number(id)
  if (!Number.isFinite(notaId)) notFound()

  const data = await getConferencia(notaId)
  if (!data) notFound()

  // Bloqueia acesso server-side: se ainda há itens sem vínculo, volta para a lista.
  // Isso impede que o estoquista inicie a conferência mesmo acessando a URL diretamente.
  if (data.itensPendentes > 0) {
    redirect(`/estoque/conferencia?aviso=vinculacao_pendente&nota=${notaId}`)
  }

  const canManageCadastros = roleHasPermission(user.role, "gerenciar_cadastros")

  return <ConferenciaScanner initial={data} canBind={canManageCadastros} estoquistaNome={user.name ?? ""} />
}
