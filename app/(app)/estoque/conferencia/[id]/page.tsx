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

  const canManageCadastros = roleHasPermission(user.role, "gerenciar_cadastros")

  return <ConferenciaScanner initial={data} canBind={canManageCadastros} estoquistaNome={user.name ?? ""} />
}
