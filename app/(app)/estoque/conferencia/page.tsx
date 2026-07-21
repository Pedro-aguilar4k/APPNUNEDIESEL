import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { ConferenciaList } from "@/components/conferencia/conferencia-list"

export default async function ConferenciaPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "conferir")) redirect("/")
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conferência"
        description="Selecione uma nota para conferir os itens por leitura de código de barras."
      />
      <ConferenciaList />
    </div>
  )
}
