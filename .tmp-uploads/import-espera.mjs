import { readFile } from "node:fs/promises"
import { read, utils } from "xlsx"
import pg from "pg"

const filePath = process.argv[2]
const COMMIT = process.argv.includes("--commit")

if (!filePath) {
  console.error("Uso: node import-espera.mjs <arquivo.xlsx> [--commit]")
  process.exit(1)
}

// ---- 1. Ler e consolidar a planilha ----------------------------------------
const buf = await readFile(filePath)
const wb = read(buf, { cellDates: true })
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = utils.sheet_to_json(sheet, { defval: null })

function parseQnt(v) {
  if (v == null) return null
  const s = String(v).trim()
  const m = s.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

// Consolida por codigo: soma saldo, guarda boxes distintos em ordem.
const mapa = new Map()
const ignorados = []
for (const r of rows) {
  const codigo = r.CODIGO == null ? "" : String(r.CODIGO).trim()
  const box = r.BOX == null ? "" : String(r.BOX).trim()
  const qnt = parseQnt(r.QNT)
  if (!codigo || !box || !qnt || qnt < 1) {
    ignorados.push(r)
    continue
  }
  const cur = mapa.get(codigo) || { codigo, total: 0, boxes: [] }
  cur.total += qnt
  if (!cur.boxes.includes(box)) cur.boxes.push(box)
  mapa.set(codigo, cur)
}

const consolidados = [...mapa.values()]
console.log(`Linhas na planilha: ${rows.length}`)
console.log(`Ignoradas (sem codigo/box/qnt): ${ignorados.length}`)
console.log(`Codigos unicos consolidados: ${consolidados.length}`)
console.log(`Codigos com 2 boxes: ${consolidados.filter((c) => c.boxes.length > 1).length}`)
console.log(`Codigos com 3+ boxes (excedente ignorado): ${consolidados.filter((c) => c.boxes.length > 2).length}`)

// ---- 2. Conectar ao banco ---------------------------------------------------
let cs = process.env.DATABASE_URL
if (!cs) {
  console.error("DATABASE_URL nao definido")
  process.exit(1)
}
const url = new URL(cs)
url.searchParams.delete("sslmode")
const pool = new pg.Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } })

// admin para createdBy / log
const { rows: admins } = await pool.query(
  "select id, name from \"user\" where role = 'admin' or username = 'admin' order by \"createdAt\" asc limit 1",
)
const admin = admins[0]
if (!admin) {
  console.error("Nenhum usuario admin encontrado para createdBy.")
  process.exit(1)
}
console.log(`createdBy = ${admin.name} (${admin.id})`)

// existentes
const { rows: existentesRows } = await pool.query("select codigo_interno from espera_itens")
const existentes = new Set(existentesRows.map((r) => r.codigo_interno))
const novos = consolidados.filter((c) => !existentes.has(c.codigo))
const colisoes = consolidados.filter((c) => existentes.has(c.codigo))
console.log(`Ja existem na espera (serao somados): ${colisoes.length}`)
console.log(`Novos (serao inseridos): ${novos.length}`)
if (colisoes.length) console.log("Colisoes:", colisoes.map((c) => c.codigo).join(", "))

if (!COMMIT) {
  console.log("\n--- PREVIA (dry-run). Rode com --commit para gravar. ---")
  console.log(JSON.stringify(consolidados.slice(0, 10), null, 2))
  await pool.end()
  process.exit(0)
}

// ---- 3. Gravar em transacao -------------------------------------------------
const client = await pool.connect()
try {
  await client.query("BEGIN")
  let inseridos = 0
  let somados = 0
  for (const c of consolidados) {
    const boxPrimario = c.boxes[0]
    const boxSecundario = c.boxes[1] ?? null
    const res = await client.query(
      `insert into espera_itens
        (codigo_interno, descricao, tipo, unidades_por_embalagem, total_unidades, box_primario, box_secundario, created_by)
       values ($1, (select descricao from produtos where codigo_interno = $1 limit 1), 'unidade', 1, $2, $3, $4, $5)
       on conflict (codigo_interno) do update set
         total_unidades = espera_itens.total_unidades + excluded.total_unidades,
         box_primario = excluded.box_primario,
         box_secundario = coalesce(excluded.box_secundario, espera_itens.box_secundario),
         updated_at = now()
       returning (xmax = 0) as inserted`,
      [c.codigo, c.total, boxPrimario, boxSecundario, admin.id],
    )
    if (res.rows[0].inserted) inseridos++
    else somados++
  }
  await client.query(
    `insert into logs (actor_id, actor_nome, area, acao, detalhe) values ($1, $2, 'espera', 'importou', $3)`,
    [
      admin.id,
      admin.name,
      `Importou planilha da espera: ${inseridos} itens novos, ${somados} somados (total ${consolidados.length} codigos).`,
    ],
  )
  await client.query("COMMIT")
  console.log(`\nOK. Inseridos: ${inseridos} | Somados: ${somados}`)
} catch (e) {
  await client.query("ROLLBACK")
  console.error("ERRO, rollback:", e.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
