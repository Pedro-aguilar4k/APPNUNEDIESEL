import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { NovaGarantiaForm } from "@/components/garantias/nova-garantia-form"

export default async function NovaGarantiaPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "abrir_garantia")) redirect("/")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Abrir garantia"
        description="Preencha a solicitação de garantia. Os campos marcados com * são obrigatórios."
      />
      <NovaGarantiaForm vendedorNome={user.name} />
    </div>
  )
}
