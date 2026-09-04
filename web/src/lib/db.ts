import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _sql = neon(url);
  }
  return _sql;
}

/** Idempotent schema setup, called from the migrate script. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS plan_courses (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('taken', 'planned')),
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, code)
);
CREATE INDEX IF NOT EXISTS plan_courses_user ON plan_courses(user_id);
`;

export async function ensureUser(email: string, name?: string | null): Promise<number> {
  const rows = (await sql()`
    INSERT INTO users (email, name) VALUES (${email}, ${name ?? null})
    ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name)
    RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}
