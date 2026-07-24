import pg from "pg"
import { randomBytes, createHmac } from "node:crypto"

const secret = process.env.BETTER_AUTH_SECRET
if (!secret) { console.error("no secret"); process.exit(1) }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const email = "admin@conferencia.local"

const { rows } = await pool.query('SELECT id FROM "user" WHERE email=$1 LIMIT 1', [email])
if (!rows.length) { console.error("no user"); process.exit(1) }
const userId = rows[0].id

const token = randomBytes(32).toString("hex")
const id = randomBytes(16).toString("hex")
const now = new Date()
const expires = new Date(now.getTime() + 12 * 60 * 60 * 1000)

await pool.query(
  'INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6)',
  [id, token, userId, expires, now, now],
)

const signature = createHmac("sha256", secret).update(token).digest("base64url")
const cookieValue = `${token}.${signature}`
console.log("COOKIE=" + cookieValue)
await pool.end()
