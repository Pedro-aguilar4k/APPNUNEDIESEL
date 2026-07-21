import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { ComingSoon } from "@/components/coming-soon"

export default async function ReconhecimentoPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "gerenciar_notas")) redirect("/")
  return (
    <div className="space-y-6">
      <PageHeader title="Reconhecimento" description="Revise e confirme os vínculos sugeridos pelo matching." />
      <ComingSoon title="Central de reconhecimento" />
    </div>
  )
}
