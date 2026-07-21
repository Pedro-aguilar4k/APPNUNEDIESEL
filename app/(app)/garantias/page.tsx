import Link from "next/link"
import { requireUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { roleHasPermission } from "@/lib/permissions"
import { listMinhasGarantias } from "@/app/actions/garantias"
import { PageHeader } from "@/components/page-header"
import { MinhasGarantiasList } from "@/components/garantias/minhas-garantias-list"
import { Button } from "@/components/ui/button"
import { ShieldPlus } from "lucide-react"

export default async function MinhasGarantiasPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "abrir_garantia")) redirect("/")

  const garantias = await listMinhasGarantias()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Minhas garantias"
        description="Solicitações de garantia abertas por você, com o status atual de cada uma."
        actions={
          <Button asChild>
            <Link href="/garantias/nova">
              <ShieldPlus className="h-4 w-4" aria-hidden="true" />
              Abrir garantia
            </Link>
          </Button>
        }
      />
      <MinhasGarantiasList garantias={garantias} />
    </div>
  )
}
