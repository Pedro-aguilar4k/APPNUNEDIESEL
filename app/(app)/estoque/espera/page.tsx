import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { EsperaManager } from "@/components/estoque/espera-manager"
import { listEspera } from "@/app/actions/espera"

export default async function EsperaPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "conferir")) redirect("/")

  const itens = await listEspera()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Espera"
        description="Pulmão do estoque: itens que não couberam na locação normal, guardados por box. Pesquise pelo código para localizar."
      />
      <EsperaManager itens={itens} />
    </div>
  )
}
