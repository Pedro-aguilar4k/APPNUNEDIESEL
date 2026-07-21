import { requireUser } from "@/lib/session"
import { AppSidebarDesktop } from "@/components/app-sidebar-desktop"
import { AppHeader } from "@/components/app-header"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebarDesktop user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
