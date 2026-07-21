import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { hasAnyUser } from "@/app/actions/bootstrap"
import { LoginForm } from "@/components/login-form"

export default async function LoginPage() {
  const session = await getSession()
  if (session?.user) redirect("/")

  const configured = await hasAnyUser()
  if (!configured) redirect("/setup")

  return <LoginForm />
}
