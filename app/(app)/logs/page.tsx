import { redirect } from "next/navigation"
import { requireUser } from "@/lib/session"
import { roleHasPermission } from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { listLogs } from "@/app/actions/logs"
import { LogsManager } from "@/components/logs/logs-manager"

export default async function LogsPage() {
  const user = await requireUser()
  if (!roleHasPermission(user.role, "ver_logs")) redirect("/")

  const logs = await listLogs()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logs de auditoria"
        description="Registro de quem fez o quê em cada área da plataforma."
      />
      <LogsManager logs={logs} />
    </div>
  )
}
