import { read, utils } from "xlsx"
import { readFileSync } from "node:fs"

const path = process.argv[2]
const wb = read(readFileSync(path), { cellDates: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = utils.sheet_to_json(ws, { defval: "" })

// Padrões da coluna QNT
const unidades = new Set()
let comUndPorEmb = 0
let semQnt = 0
const boxes = new Set()
const codigos = []
const codigoDup = {}

const qntRegex = /^\s*(\d+)\s*([a-zA-Z]+)\s*$/

let naoBatem = []

for (const r of rows) {
  const cod = String(r.CODIGO ?? "").trim()
  const box = String(r.BOX ?? "").trim()
  const qnt = String(r.QNT ?? "").trim()
  const upe = String(r.UND_POR_EMB ?? "").trim()
  if (upe) comUndPorEmb++
  if (!qnt) semQnt++
  boxes.add(box)
  codigos.push(cod)
  codigoDup[cod] = (codigoDup[cod] || 0) + 1
  const m = qnt.match(qntRegex)
  if (m) {
    unidades.add(m[2].toUpperCase())
  } else {
    naoBatem.push(qnt)
  }
}

console.log("Total registros:", rows.length)
console.log("Linhas com UND_POR_EMB preenchida:", comUndPorEmb)
console.log("Linhas sem QNT:", semQnt)
console.log("Unidades distintas em QNT:", [...unidades])
console.log("QNT que NÃO batem no padrão (num + texto):", naoBatem.slice(0, 30))
console.log("Qtde de QNT fora do padrão:", naoBatem.length)
console.log("Total de boxes distintos:", boxes.size)
console.log("Amostra de boxes:", [...boxes].slice(0, 20))
const dups = Object.entries(codigoDup).filter(([, n]) => n > 1)
console.log("Códigos duplicados:", dups.length, dups.slice(0, 10))
