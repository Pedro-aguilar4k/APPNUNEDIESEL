import { Pool } from "pg"

const url = new URL(process.env.DATABASE_URL)
url.searchParams.delete("sslmode")
const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } })

const r = await pool.query(
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS numero_orcamento text;`,
)
console.log("OK - coluna numero_orcamento garantida.")
await pool.end()
