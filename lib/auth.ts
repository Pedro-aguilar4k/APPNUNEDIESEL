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
  trustedOrigins: [
    ...(isDev
      ? [
          // Em dev o app pode ser acessado por localhost (qualquer porta),
          // 127.0.0.1 ou pela URL de preview do v0. Confiamos em todos eles
          // para evitar erros "Invalid origin" no fluxo de login.
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:*",
          "http://127.0.0.1:*",
        ]
      : []),
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
  ],
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
