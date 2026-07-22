import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const sql = `
CREATE TABLE IF NOT EXISTS modulos_controle (
  id serial PRIMARY KEY,
  titulo text NOT NULL,
  colunas jsonb NOT NULL,
  linhas jsonb NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_by text,
  created_by_nome text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS modulos_controle_ordem_idx ON modulos_controle (ordem);
`

try {
  await pool.query(sql)
  console.log("OK: tabela modulos_controle criada/verificada")
} catch (e) {
  console.error("ERR", e.message)
  process.exit(1)
} finally {
  await pool.end()
}
