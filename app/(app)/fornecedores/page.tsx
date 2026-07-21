import { redirect } from "next/navigation"
import { requireUser } from "@/lib/session"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { FornecedoresManager } from "@/components/fornecedores/fornecedores-manager"

export default async function FornecedoresPage() {
  const user = await requireUser()
  const canManage = roleHasPermission(user.role, "gerenciar_cadastros")
  if (!canManage) redirect("/")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        description="Cadastro dos fornecedores e seus dados de contato."
      />
      <FornecedoresManager canManage={canManage} />
    </div>
  )
}
