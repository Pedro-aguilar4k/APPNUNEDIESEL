import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Boxes } from "lucide-react"

export default async function ControleEstoquePage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "conferir")) redirect("/")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Controle de estoque"
        description="Acompanhamento de saldo e movimentações dos produtos."
      />
      <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Boxes className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Em breve</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
            Esta área vai concentrar o controle de estoque. Vamos definir o conteúdo em seguida.
          </p>
        </div>
      </Card>
    </div>
  )
}
