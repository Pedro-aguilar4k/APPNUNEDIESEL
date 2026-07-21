import { redirect } from "next/navigation"
import { requireUser } from "@/lib/session"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { ProdutosManager } from "@/components/produtos/produtos-manager"

export default async function ProdutosPage() {
  const user = await requireUser()
  const canManage = roleHasPermission(user.role, "gerenciar_cadastros")
  if (!canManage) redirect("/")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Cadastro de produtos do estoque, com códigos, fabricante e localização."
      />
      <ProdutosManager canManage={canManage} />
    </div>
  )
}
