import { redirect } from "next/navigation"
import { hasAnyUser } from "@/app/actions/bootstrap"
import { SetupForm } from "@/components/setup-form"

export default async function SetupPage() {
  const configured = await hasAnyUser()
  if (configured) redirect("/login")
  return <SetupForm />
}
