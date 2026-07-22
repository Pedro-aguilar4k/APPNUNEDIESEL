import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { getVinculacaoData, listCompradores } from "@/app/actions/vinculacao"
import { VinculacaoManager } from "@/components/notas/vinculacao-manager"

export default async function ReconhecerVincularPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "gerenciar_notas")) redirect("/")

  const { id } = await params
  const notaId = Number(id)
  if (!Number.isFinite(notaId)) redirect("/reconhecimento")

  const [data, compradores] = await Promise.all([getVinculacaoData(notaId), listCompradores()])
  if (!data) redirect("/reconhecimento")

  return <VinculacaoManager data={data} compradores={compradores} />
}
