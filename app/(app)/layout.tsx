import { requireUser } from "@/lib/session"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="fixed inset-y-0 w-64">
          <AppSidebar user={user} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
