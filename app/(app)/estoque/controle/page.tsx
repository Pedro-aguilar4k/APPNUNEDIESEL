import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { ControleManager } from "@/components/controle/controle-manager"
import { listModulos } from "@/app/actions/controle"

export default async function ControleEstoquePage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "conferir")) redirect("/")

  const canWrite =
    roleHasPermission(user.role, "gerenciar_notas") ||
    roleHasPermission(user.role, "gerenciar_cadastros") ||
    roleHasPermission(user.role, "conferir")

  const modulos = await listModulos()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Controle"
        description="Monte módulos com os indicadores que a equipe precisa acompanhar."
      />
      <ControleManager modulosIniciais={modulos} canWrite={canWrite} />
    </div>
  )
}
