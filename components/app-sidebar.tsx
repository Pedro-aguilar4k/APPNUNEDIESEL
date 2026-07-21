"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { NAV_ITEMS, GROUP_LABELS, type NavItem } from "@/lib/navigation"
import { roleHasPermission, ROLE_LABELS, type Role } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/lib/session"

export function AppSidebar({
  user,
  onNavigate,
  collapsed = false,
  onToggle,
}: {
  user: SessionUser
  onNavigate?: () => void
  collapsed?: boolean
  onToggle?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const allowed = NAV_ITEMS.filter((item) => roleHasPermission(user.role, item.permission))

  const groups = allowed.reduce<Record<string, NavItem[]>>((acc, item) => {
    ;(acc[item.group] ??= []).push(item)
    return acc
  }, {})

  const handleLogout = async () => {
    await authClient.signOut()
    router.push("/login")
    router.refresh()
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  return (
    <div className={cn("app-shell flex h-full flex-col app-sidebar", collapsed && "is-collapsed")}>
      <div className={cn("app-sidebar-brand", collapsed && "justify-center px-0")}>
        {!collapsed && (
          <>
            <Image
              src="/nune-logo.png"
              alt=""
              width={52}
              height={34}
              className="brand-logo h-9 w-14 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#101426]">NuneDiesel</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8a91a0]">
                Autopeças · Linha pesada
              </p>
            </div>
          </>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className={cn("app-icon-button", !collapsed && "ml-auto")}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>

      <nav
        className={cn("flex-1 space-y-5 overflow-y-auto py-5", collapsed ? "px-2" : "px-3")}
        aria-label="Navegação principal"
      >
        {(Object.keys(groups) as NavItem["group"][]).map((group) => (
          <div key={group}>
            {!collapsed && <p className="app-nav-label">{GROUP_LABELS[group]}</p>}
            <div className="flex flex-col gap-1">
              {groups[group].map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    data-category={item.category}
                    className={cn("app-nav-link", active && "is-active", collapsed && "justify-center px-0")}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="app-nav-icon h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {collapsed ? (
        <div className="flex flex-col items-center gap-2 border-t border-[var(--brand-line)] py-3">
          <div className="app-user-avatar" title={`${user.name || user.username} · ${ROLE_LABELS[user.role as Role]}`}>
            {(user.name || user.username || "?")[0]?.toUpperCase()}
          </div>
          <Link
            href="/configuracoes"
            onClick={onNavigate}
            className={cn("app-icon-button", isActive("/configuracoes") && "is-active")}
            aria-label="Configurações"
            title="Configurações"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button onClick={handleLogout} className="app-icon-button" aria-label="Sair" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="app-user-card">
          <div className="app-user-avatar">{(user.name || user.username || "?")[0]?.toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#202538]">{user.name || user.username}</p>
            <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[#8a91a0]">
              {ROLE_LABELS[user.role as Role]}
            </p>
          </div>
          <Link
            href="/configuracoes"
            onClick={onNavigate}
            className={cn("app-icon-button", isActive("/configuracoes") && "is-active")}
            aria-label="Configurações"
            title="Configurações"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button onClick={handleLogout} className="app-icon-button" aria-label="Sair" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
