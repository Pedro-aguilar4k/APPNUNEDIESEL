import { read, utils } from "xlsx"
import { readFileSync } from "node:fs"

const path = process.argv[2]
const buf = readFileSync(path)
const wb = read(buf, { cellDates: true })

console.log("=== SHEETS ===")
console.log(wb.SheetNames)

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const rows = utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" })
  console.log(`\n=== SHEET: ${name} (linhas: ${rows.length}) ===`)
  console.log("Primeiras 12 linhas (array):")
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    console.log(i, JSON.stringify(rows[i]))
  }
  const asObj = utils.sheet_to_json(ws, { defval: "" })
  console.log("\nComo objetos (primeiras 6):")
  console.log(JSON.stringify(asObj.slice(0, 6), null, 2))
  console.log("Total de registros (objetos):", asObj.length)
}
