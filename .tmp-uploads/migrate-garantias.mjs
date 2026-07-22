import pg from "pg"

const { Pool } = pg
const url = new URL(process.env.DATABASE_URL)
url.searchParams.delete("sslmode")
const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } })

const stmts = [
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS prazo_garantia text`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS prazo_validado boolean NOT NULL DEFAULT false`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS nfg_numero text`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS transportadora_nome text`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS data_envio text`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS frete_conta text`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS envio_cadastrado boolean NOT NULL DEFAULT false`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS nota_entrada text`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS procedencia text`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS tipo_retorno text`,
  `ALTER TABLE garantias ADD COLUMN IF NOT EXISTS concluido_em timestamp`,
  `CREATE TABLE IF NOT EXISTS garantia_rejeicoes (
     id serial PRIMARY KEY,
     vendedor_id text,
     protocolo text NOT NULL,
     produto_descricao text,
     cliente_nome text,
     motivo text NOT NULL,
     etapa text,
     dados_originais jsonb NOT NULL,
     reaberta boolean NOT NULL DEFAULT false,
     rejeitada_em timestamp NOT NULL DEFAULT now(),
     expira_em timestamp NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS garantia_rejeicoes_vendedor_id_idx ON garantia_rejeicoes (vendedor_id)`,
  `CREATE INDEX IF NOT EXISTS garantia_rejeicoes_expira_em_idx ON garantia_rejeicoes (expira_em)`,
]

const run = async () => {
  const client = await pool.connect()
  try {
    for (const s of stmts) {
      await client.query(s)
      console.log("OK:", s.split("\n")[0].slice(0, 70))
    }
    console.log("\nMigração concluída com sucesso.")
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((e) => {
  console.error("ERRO:", e.message)
  process.exit(1)
})
