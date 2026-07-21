import { requireUser } from "@/lib/session"
import { getPreferencias } from "@/app/actions/preferencias"
import { PageHeader } from "@/components/page-header"
import { ConfiguracoesManager } from "@/components/configuracoes/configuracoes-manager"
import { ROLE_LABELS, type Role } from "@/lib/permissions"

export default async function ConfiguracoesPage() {
  const user = await requireUser()
  const preferencias = await getPreferencias()

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Gerencie seu perfil, segurança e as preferências do sistema."
      />
      <ConfiguracoesManager
        user={{
          name: user.name,
          username: user.username,
          role: ROLE_LABELS[user.role as Role],
        }}
        preferencias={preferencias}
      />
    </div>
  )
}
