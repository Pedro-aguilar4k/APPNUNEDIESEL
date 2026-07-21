import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { RelatoriosManager } from "@/components/relatorios/relatorios-manager"

export default async function RelatoriosPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "relatorios")) redirect("/")
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Relatórios" description="Acompanhe as conferências e exporte os dados por período." />
      <RelatoriosManager />
    </div>
  )
}
