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
  let cleanConnectionString = connectionString
  try {
    const url = new URL(connectionString)
    host = url.hostname
    // Remove o `sslmode` da URL para o driver `pg` não emitir o warning de
    // depreciação ao interpretá-lo. O SSL passa a ser controlado pela opção
    // `ssl` abaixo.
    url.searchParams.delete("sslmode")
    cleanConnectionString = url.toString()
  } catch {
    host = ""
  }

  const isLocal = host === "localhost" || host === "127.0.0.1"

  return {
    connectionString: cleanConnectionString,
    // Em produção (ex.: Neon) mantém a verificação completa do certificado.
    // Em conexões locais o SSL fica desativado.
    ssl: isLocal ? false : { rejectUnauthorized: true },
  }
}

export const pool = new Pool(getConnectionConfig())

export const db = drizzle(pool, { schema })
