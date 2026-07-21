import { betterAuth } from "better-auth"
import { username, admin } from "better-auth/plugins"
import { pool } from "@/lib/db"

const isDev = process.env.NODE_ENV === "development"

// O baseURL precisa ser explícito e coincidir com a origem que o navegador usa,
// caso contrário o Better Auth rejeita o login com "Invalid origin".
// - Em dev, servimos por http://localhost:3000.
// - Em produção usamos o domínio de deploy (Vercel) ou a URL do runtime v0.
const resolvedBaseURL = isDev
  ? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  : process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL)

export const auth = betterAuth({
  database: pool,
  baseURL: resolvedBaseURL,
  emailAndPassword: {
    enabled: true,
    // Sem cadastro publico: apenas o administrador cria contas (plugin admin).
    disableSignUp: true,
  },
  // Usamos a forma de FUNÇÃO para computar as origens confiáveis a partir da
  // própria requisição. O app roda atrás do proxy do sandbox (o Host real é um
  // domínio *.vercel.run, mas o navegador acessa via http://localhost:3000 ou
  // pela URL de preview https). Confiar na origem/host da própria requisição
  // garante que o login funcione em qualquer um desses contextos same-origin,
  // evitando falsos "Invalid origin".
  trustedOrigins: (request?: Request) => {
    const origins = new Set<string>()

    // Atenção: o Better Auth também chama esta função na inicializacao do
    // contexto SEM um request. Por isso todo acesso a headers é opcional.
    const headers = request?.headers

    const originHeader = headers?.get("origin")
    if (originHeader && originHeader !== "null") origins.add(originHeader)

    const referer = headers?.get("referer")
    if (referer) {
      try {
        origins.add(new URL(referer).origin)
      } catch {}
    }

    // Reconstrói a origem a partir dos headers de proxy / host.
    const forwardedHost = headers?.get("x-forwarded-host")
    const host = forwardedHost ?? headers?.get("host")
    if (host) {
      const proto = headers?.get("x-forwarded-proto") ?? "https"
      origins.add(`${proto}://${host}`)
    }

    // Origens estáticas conhecidas (dev local + deploy).
    origins.add("http://localhost:3000")
    origins.add("http://127.0.0.1:3000")
    if (process.env.V0_RUNTIME_URL) origins.add(process.env.V0_RUNTIME_URL)
    if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`)
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    }

    return Array.from(origins)
  },
  session: {
    expiresIn: 60 * 60 * 12, // 12 horas (igual ao sistema original)
    updateAge: 60 * 60 * 4,
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 40,
    }),
    admin({
      adminRoles: ["admin"],
      defaultRole: "estoquista",
    }),
  ],
  ...(isDev
    ? {
        advanced: {
          // Em dev servimos por http://localhost, onde cookies "secure" são
          // descartados pelo navegador. SameSite=Lax + secure:false garante que
          // a sessão persista localmente. Em produção o Better Auth usa os
          // padrões seguros (secure) automaticamente.
          defaultCookieAttributes: {
            sameSite: "lax" as const,
            secure: false,
          },
        },
      }
    : {}),
})
