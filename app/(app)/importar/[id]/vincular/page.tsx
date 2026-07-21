import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { getVinculacaoData } from "@/app/actions/vinculacao"
import { VinculacaoManager } from "@/components/notas/vinculacao-manager"

export default async function VincularPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "gerenciar_notas")) redirect("/")

  const { id } = await params
  const notaId = Number(id)
  if (!Number.isFinite(notaId)) redirect("/importar")

  const data = await getVinculacaoData(notaId)
  if (!data) redirect("/importar")

  return <VinculacaoManager data={data} />
}
