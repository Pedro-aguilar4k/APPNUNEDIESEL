import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { ImportManager } from "@/components/notas/import-manager"

export default async function ImportarPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "gerenciar_notas")) redirect("/")
  return (
    <div className="space-y-6">
      <PageHeader title="Importar NF-e" description="Importe notas fiscais por XML para conferência automática." />
      <ImportManager />
    </div>
  )
}
