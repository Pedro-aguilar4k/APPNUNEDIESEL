import { read, utils } from "xlsx"
import { readFileSync } from "node:fs"

const wb = read(readFileSync(process.argv[2]), { cellDates: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = utils.sheet_to_json(ws, { defval: "" })

console.log("=== Linhas com UND_POR_EMB preenchida ===")
for (const r of rows) {
  if (String(r.UND_POR_EMB ?? "").trim()) console.log(JSON.stringify(r))
}

console.log("\n=== Registros dos códigos duplicados ===")
const alvo = ["10295", "11803", "13159", "13891", "16691", "18892", "21108", "203562"]
for (const cod of alvo) {
  const encontrados = rows.filter((r) => String(r.CODIGO).trim() === cod)
  console.log(cod, JSON.stringify(encontrados))
}

console.log("\n=== Contagem por tipo de embalagem ===")
const cont = { CX: 0, UND: 0, PCT: 0 }
for (const r of rows) {
  const m = String(r.QNT).trim().match(/([a-zA-Z]+)\s*$/)
  if (m) cont[m[1].toUpperCase()] = (cont[m[1].toUpperCase()] || 0) + 1
}
console.log(cont)
