// Papeis e permissoes do sistema de conferencia de NF-e.
// Portado 1:1 do backend FastAPI original (services/auth.py).

export const ROLES = ["admin", "gerente", "comprador", "estoquista"] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  comprador: "Comprador",
  estoquista: "Estoquista",
}

export const PERMISSIONS = {
  view: "view",
  conferir: "conferir",
  gerenciar_notas: "gerenciar_notas",
  gerenciar_cadastros: "gerenciar_cadastros",
  relatorios: "relatorios",
  gerenciar_usuarios: "gerenciar_usuarios",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const PERMISSION_ROLES: Record<Permission, Role[]> = {
  view: ["admin", "gerente", "comprador", "estoquista"],
  conferir: ["admin", "gerente", "comprador", "estoquista"],
  gerenciar_notas: ["admin", "gerente", "comprador"],
  gerenciar_cadastros: ["admin", "gerente", "comprador"],
  relatorios: ["admin", "gerente"],
  gerenciar_usuarios: ["admin"],
}

export function roleHasPermission(role: string, permission: Permission): boolean {
  const roles = PERMISSION_ROLES[permission]
  if (!roles) return false
  return roles.includes(role as Role)
}

export function permissionsForRole(role: string): Permission[] {
  return (Object.keys(PERMISSION_ROLES) as Permission[]).filter((perm) =>
    PERMISSION_ROLES[perm].includes(role as Role),
  )
}

export function isValidRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role)
}
