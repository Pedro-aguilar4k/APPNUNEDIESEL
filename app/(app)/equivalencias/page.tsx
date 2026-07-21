import { redirect } from "next/navigation"
import { requireUser } from "@/lib/session"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { EquivalenciasManager } from "@/components/equivalencias/equivalencias-manager"

export default async function EquivalenciasPage() {
  const user = await requireUser()
  const canManage = roleHasPermission(user.role, "gerenciar_cadastros")
  if (!canManage) redirect("/")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equivalências"
        description="Vínculos aprendidos entre os códigos dos fornecedores e os produtos internos. Alimentam o reconhecimento automático."
      />
      <EquivalenciasManager canManage={canManage} />
    </div>
  )
}
