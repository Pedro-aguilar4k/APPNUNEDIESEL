import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

function getConnectionConfig() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL não está definida no ambiente")
  }

  // Controla o SSL explicitamente em vez de deixar o driver interpretar o
  // `sslmode` da URL. Isso evita o warning de depreciação do `pg`
  // (SSL modes 'prefer'/'require'/'verify-ca' tratados como 'verify-full')
  // mantendo o mesmo comportamento seguro de verificação completa do certificado.
  let host = ""
  try {
    host = new URL(connectionString).hostname
  } catch {
    host = ""
  }

  const isLocal = host === "localhost" || host === "127.0.0.1"

  return {
    connectionString,
    // Em produção (ex.: Neon) mantém a verificação completa do certificado.
    // Em conexões locais o SSL fica desativado.
    ssl: isLocal ? false : { rejectUnauthorized: true },
  }
}

export const pool = new Pool(getConnectionConfig())

export const db = drizzle(pool, { schema })
