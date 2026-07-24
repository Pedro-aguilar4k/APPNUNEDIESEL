import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { ConferenciaList } from "@/components/conferencia/conferencia-list"
import { AlertTriangle } from "lucide-react"

export default async function ConferenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; nota?: string }>
}) {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "conferir")) redirect("/")

  const { aviso } = await searchParams
  const avisoVinculacao = aviso === "vinculacao_pendente"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conferência"
        description="Selecione uma nota para conferir os itens por leitura de código de barras."
      />
      {avisoVinculacao && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Esta nota ainda possui itens sem produto vinculado. Finalize a vinculação em{" "}
            <strong>Importar XML</strong> antes de iniciar a conferência.
          </span>
        </div>
      )}
      <ConferenciaList />
    </div>
  )
}
