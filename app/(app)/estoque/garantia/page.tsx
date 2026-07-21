import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { GarantiaBoard } from "@/components/estoque/garantia-board"

export default async function GarantiaPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "conferir")) redirect("/")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Garantia"
        description="Tickets de garantia abertos pelo formulário externo, organizados por status."
      />
      <GarantiaBoard />
    </div>
  )
}
