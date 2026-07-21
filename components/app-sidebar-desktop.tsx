"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/lib/session"

const STORAGE_KEY = "nd-sidebar-collapsed"

export function AppSidebarDesktop({ user }: { user: SessionUser }) {
  const [collapsed, setCollapsed] = useState(false)

  // Carrega a preferência salva (evita flash lendo só após montar).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      // ignore
    }
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {
        // ignore
      }
      return next
    })
  }

  const width = collapsed ? "w-16" : "w-64"

  return (
    <aside className={cn("hidden shrink-0 transition-[width] duration-200 ease-out md:block", width)}>
      <div className={cn("fixed inset-y-0 transition-[width] duration-200 ease-out", width)}>
        <AppSidebar user={user} collapsed={collapsed} onToggle={toggle} />
      </div>
    </aside>
  )
}
