import pg from "pg"

const url = new URL(process.env.DATABASE_URL)
url.searchParams.delete("sslmode")
const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1"

const pool = new pg.Pool({
  connectionString: url.toString(),
  ssl: isLocal ? false : { rejectUnauthorized: true },
})

const ins = await pool.query(
  `INSERT INTO garantias (
    protocolo, vendedor_id, vendedor_nome, status,
    cliente_nome, cliente_contato, cliente_fone, cliente_email,
    nota_numero, data_compra, loja,
    peca_numero, produto_descricao, peca_marca, veiculo, ano_modelo, motor,
    km_inicial, km_defeito, km_rodado, horas_rodadas, data_aplicacao, data_defeito,
    descricao_defeito
  ) VALUES (
    '', NULL, 'Teste (avaliação)', 'pendente',
    'Transportadora Silva Ltda', 'Carlos Silva', '(45) 99912-3456', 'carlos@silvatransportes.com',
    'NF-84213', '2026-05-12', 'Nune Diesel - Matriz',
    'BOSCH-0445120212', 'Bico injetor common rail', 'Bosch', 'Volvo FH 460', '2021/2022', 'D13 Euro 5',
    '210000', '248000', '38000', '4200', '2026-05-20', '2026-07-18',
    'Bico injetor apresentando falha de pulverizacao, causando falha de partida a frio e fumaca branca excessiva. Cliente relata perda de potencia apos 38 mil km de uso.'
  ) RETURNING id`,
)
const id = ins.rows[0].id
const protocolo = `GAR-${String(id).padStart(6, "0")}`
await pool.query(`UPDATE garantias SET protocolo = $1 WHERE id = $2`, [protocolo, id])
console.log(`OK - garantia de teste criada: ${protocolo} (id ${id}), status Pendente.`)
await pool.end()
