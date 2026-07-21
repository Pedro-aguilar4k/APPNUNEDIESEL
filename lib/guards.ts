import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { roleHasPermission, type Permission } from "@/lib/permissions"

export type Actor = { id: string; role: string; name: string }

/**
 * Garante que há sessão e retorna o usuário. Lança se não autenticado.
 * Uso em server actions (dados compartilhados; controle por papel).
 */
export async function requireActor(): Promise<Actor> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Não autenticado.")
  const u = session.user as unknown as { id: string; role: string | null; name: string }
  return { id: u.id, role: u.role ?? "estoquista", name: u.name }
}

/**
 * Garante que o usuário atual tem a permissão exigida.
 */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor()
  if (!roleHasPermission(actor.role, permission)) {
    throw new Error("Você não tem permissão para esta ação.")
  }
  return actor
}

/**
 * Garante que o usuário tem ao menos uma das permissões informadas.
 */
export async function requireAnyPermission(...permissions: Permission[]): Promise<Actor> {
  const actor = await requireActor()
  if (!permissions.some((p) => roleHasPermission(actor.role, p))) {
    throw new Error("Você não tem permissão para esta ação.")
  }
  return actor
}
