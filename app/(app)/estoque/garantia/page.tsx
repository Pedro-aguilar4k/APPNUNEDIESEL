import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { GarantiaBoard } from "@/components/estoque/garantia-board"
import { listGarantias } from "@/app/actions/garantias"

export default async function GarantiaPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "gerenciar_garantia")) redirect("/")

  const garantias = await listGarantias()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Garantia"
        description="Tickets de garantia abertos pelos vendedores, organizados por status."
      />
      <GarantiaBoard garantias={garantias} />
    </div>
  )
}
