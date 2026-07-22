import pg from "pg"

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const stmts = [
  `ALTER TABLE itens_nota ADD COLUMN IF NOT EXISTS icms numeric`,
  `ALTER TABLE itens_nota ADD COLUMN IF NOT EXISTS ipi numeric`,
  `ALTER TABLE itens_nota ADD COLUMN IF NOT EXISTS impostos numeric`,
]

for (const s of stmts) {
  await pool.query(s)
  console.log("OK:", s)
}

await pool.end()
console.log("Migração de impostos concluída.")
