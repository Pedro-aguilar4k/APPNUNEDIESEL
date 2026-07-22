import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { ImportManager } from "@/components/notas/import-manager"

export default async function ReconhecimentoPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "gerenciar_notas")) redirect("/")
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconhecimento"
        description="Importe um XML apenas para absorver os produtos: informe o código interno e o item entra direto no cadastro."
      />
      <ImportManager modo="reconhecimento" />
    </div>
  )
}
