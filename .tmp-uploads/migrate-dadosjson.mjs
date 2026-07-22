import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const sql = `ALTER TABLE relatorios_conferencia ADD COLUMN IF NOT EXISTS dados_json jsonb;`

try {
  await pool.query(sql)
  console.log("OK: coluna dados_json garantida em relatorios_conferencia")
} catch (e) {
  console.error("ERRO:", e.message)
  process.exit(1)
} finally {
  await pool.end()
}
