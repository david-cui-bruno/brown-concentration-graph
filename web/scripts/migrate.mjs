/** One-time schema migration: node scripts/migrate.mjs (needs DATABASE_URL). */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

let url = process.env.DATABASE_URL;
if (!url) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    url = env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
  } catch {}
}
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(url);
await sql`CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS plan_courses (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('taken', 'planned')),
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, code)
)`;
await sql`CREATE INDEX IF NOT EXISTS plan_courses_user ON plan_courses(user_id)`;
console.log("schema ready:", (await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`).map((r) => r.tablename).join(", "));
