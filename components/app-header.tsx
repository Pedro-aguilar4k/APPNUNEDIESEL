"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useTheme } from "next-themes"
import { AppSidebar } from "@/components/app-sidebar"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Menu, Moon, Sun } from "lucide-react"
import type { SessionUser } from "@/lib/session"

const ROUTE_TITLES: { match: RegExp; eyebrow: string; title: string }[] = [
  { match: /^\/$/, eyebrow: "Central operacional", title: "Visão geral" },
  { match: /^\/importar/, eyebrow: "Recebimento", title: "Importar NF-e" },
  { match: /^\/reconhecimento/, eyebrow: "Inteligência", title: "Reconhecimento" },
  { match: /^\/estoque\/controle/, eyebrow: "Estoque", title: "Controle" },
  { match: /^\/estoque\/garantia/, eyebrow: "Estoque", title: "Garantia" },
  { match: /^\/(estoque\/conferencia|conferencia)/, eyebrow: "Estoque", title: "Conferência" },
  { match: /^\/estoque/, eyebrow: "Estoque", title: "Estoque" },
  { match: /^\/produtos/, eyebrow: "Cadastros", title: "Produtos" },
  { match: /^\/fornecedores/, eyebrow: "Cadastros", title: "Fornecedores" },
  { match: /^\/equivalencias/, eyebrow: "Cadastros", title: "Equivalências" },
  { match: /^\/relatorios/, eyebrow: "Gestão", title: "Relatórios" },
  { match: /^\/usuarios/, eyebrow: "Administração", title: "Usuários" },
]

export function AppHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"

  const page = ROUTE_TITLES.find((r) => r.match.test(pathname)) ?? ROUTE_TITLES[0]

  return (
    <header className="app-shell app-topbar sticky top-0 z-30">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="app-icon-button md:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[270px] p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <AppSidebar user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#8a91a0]">{page.eyebrow}</p>
        <p className="truncate text-sm font-semibold text-[#101426]">{page.title}</p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#737b8d] sm:flex">
          <i className="app-online-dot" aria-hidden="true" />
          Sistema online
        </span>
        <div className="hidden h-6 w-px bg-[#dfe3eb] sm:block" />
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="app-icon-button"
          aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
          title={isDark ? "Tema claro" : "Tema escuro"}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <Image src="/nune-logo.png" alt="" width={44} height={30} className="brand-logo hidden h-7 w-11 object-contain sm:block" />
      </div>
    </header>
  )
}
