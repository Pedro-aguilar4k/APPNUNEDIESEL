import { redirect } from "next/navigation"
import { requireUser } from "@/lib/session"
import { listUsers } from "@/app/actions/users"
import { PageHeader } from "@/components/page-header"
import { UsersManager } from "@/components/users/users-manager"

export default async function UsuariosPage() {
  const user = await requireUser()
  if (user.role !== "admin") redirect("/")

  const users = await listUsers()

  return (
    <div>
      <PageHeader title="Usuários" description="Gerencie contas de acesso e papéis do sistema." />
      <UsersManager users={users} currentUserId={user.id} />
    </div>
  )
}
