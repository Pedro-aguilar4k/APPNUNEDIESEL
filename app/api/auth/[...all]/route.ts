import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

const handlers = toNextJsHandler(auth.handler)

export const GET = handlers.GET

export async function POST(req: Request) {
  console.log("[v0] auth POST headers:", {
    origin: req.headers.get("origin"),
    host: req.headers.get("host"),
    xfHost: req.headers.get("x-forwarded-host"),
    xfProto: req.headers.get("x-forwarded-proto"),
    referer: req.headers.get("referer"),
  })
  return handlers.POST(req)
}
