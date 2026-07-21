import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Role } from "@/lib/permissions"

export type SessionUser = {
  id: string
  name: string
  username: string
  role: Role
}

/**
 * Retorna a sessão atual ou null. Uso em Server Components/Actions.
 */
export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session
}

/**
 * Garante que há um usuário autenticado. Redireciona para /login se não.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession()
  if (!session?.user) redirect("/login")
  const u = session.user as unknown as {
    id: string
    name: string
    username: string | null
    role: string | null
  }
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    role: (u.role as Role) ?? "estoquista",
  }
}

/**
 * Retorna apenas o id do usuário autenticado (para scoping de queries).
 */
export async function getUserId(): Promise<string> {
  const session = await getSession()
  if (!session?.user) throw new Error("Não autorizado")
  return session.user.id
}
