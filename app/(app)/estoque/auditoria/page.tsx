import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { AuditoriaManager } from "@/components/auditoria/auditoria-manager"
import { listAuditorias } from "@/app/actions/auditoria"

export default async function AuditoriaPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "conferir")) redirect("/")
  const auditorias = await listAuditorias()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoria de estoque"
        description="Conferência física do estoque comparada ao sistema oficial. Não altera o estoque oficial — apenas gera divergências."
      />
      <AuditoriaManager auditoriasIniciais={auditorias} />
    </div>
  )
}
