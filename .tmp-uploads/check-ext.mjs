import { Pool } from "pg"

const url = new URL(process.env.DATABASE_URL)
url.searchParams.delete("sslmode")
const host = url.hostname
const isLocal = host === "localhost" || host === "127.0.0.1"

const pool = new Pool({
  connectionString: url.toString(),
  ssl: isLocal ? false : { rejectUnauthorized: true },
})

const { rows } = await pool.query(
  `select extname from pg_extension order by extname`,
)
console.log("Extensões instaladas:", rows.map((r) => r.extname).join(", "))

const needed = ["unaccent", "pg_trgm"]
const installed = new Set(rows.map((r) => r.extname))
for (const ext of needed) {
  console.log(`  ${ext}: ${installed.has(ext) ? "OK" : "FALTANDO"}`)
}

await pool.end()
