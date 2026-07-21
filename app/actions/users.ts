"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { desc, eq } from "drizzle-orm"
import { isValidRole, type Role } from "@/lib/permissions"

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Não autenticado.")
  if (session.user.role !== "admin") throw new Error("Acesso restrito ao administrador.")
  return session
}

export type UserRow = {
  id: string
  name: string
  username: string | null
  role: string
  banned: boolean | null
  createdAt: Date
}

export async function listUsers(): Promise<UserRow[]> {
  await requireAdmin()
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
  return rows.map((r) => ({ ...r, role: r.role ?? "estoquista" }))
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function createUser(input: {
  name: string
  username: string
  password: string
  role: Role
}): Promise<ActionResult> {
  try {
    await requireAdmin()
    const username = input.username.trim().toLowerCase()
    const name = input.name.trim()

    if (!name || username.length < 3 || input.password.length < 8) {
      return { ok: false, error: "Nome, usuário (mín. 3) e senha (mín. 8) são obrigatórios." }
    }
    if (!isValidRole(input.role)) {
      return { ok: false, error: "Papel inválido." }
    }

    await auth.api.createUser({
      headers: await headers(),
      body: {
        name,
        email: `${username}@conferencia.local`,
        password: input.password,
        role: input.role,
        data: { username, displayUsername: input.username.trim() },
      },
    })

    revalidatePath("/usuarios")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar usuário." }
  }
}

export async function updateUserRole(userId: string, role: Role): Promise<ActionResult> {
  try {
    const session = await requireAdmin()
    if (userId === session.user.id) {
      return { ok: false, error: "Você não pode alterar seu próprio papel." }
    }
    if (!isValidRole(role)) return { ok: false, error: "Papel inválido." }

    await auth.api.setRole({
      headers: await headers(),
      body: { userId, role },
    })
    revalidatePath("/usuarios")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar papel." }
  }
}

export async function setUserBanned(userId: string, banned: boolean): Promise<ActionResult> {
  try {
    const session = await requireAdmin()
    if (userId === session.user.id) {
      return { ok: false, error: "Você não pode bloquear a si mesmo." }
    }
    if (banned) {
      await auth.api.banUser({ headers: await headers(), body: { userId } })
    } else {
      await auth.api.unbanUser({ headers: await headers(), body: { userId } })
    }
    revalidatePath("/usuarios")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar acesso." }
  }
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    if (newPassword.length < 8) return { ok: false, error: "A senha deve ter ao menos 8 caracteres." }
    await auth.api.setUserPassword({
      headers: await headers(),
      body: { userId, newPassword },
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao redefinir senha." }
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin()
    if (userId === session.user.id) {
      return { ok: false, error: "Você não pode remover a si mesmo." }
    }
    await auth.api.removeUser({ headers: await headers(), body: { userId } })
    revalidatePath("/usuarios")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao remover usuário." }
  }
}
