import { Pool } from "pg"

const url = new URL(process.env.DATABASE_URL)
url.searchParams.delete("sslmode")
const host = url.hostname
const isLocal = host === "localhost" || host === "127.0.0.1"

const pool = new Pool({
  connectionString: url.toString(),
  ssl: isLocal ? false : { rejectUnauthorized: true },
})

await pool.query("CREATE EXTENSION IF NOT EXISTS unaccent")
console.log("unaccent: criada/confirmada")
await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm")
console.log("pg_trgm: criada/confirmada")

// Valida que as funções agora existem.
const { rows } = await pool.query(
  `select similarity(unaccent(upper('Ação')), unaccent(upper('acao'))) as sim`,
)
console.log("Teste unaccent+similarity OK -> sim =", rows[0].sim)

await pool.end()
