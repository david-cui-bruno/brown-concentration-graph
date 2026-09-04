import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, ensureUser } from "@/lib/db";

/** GET /api/plan -> { courses: [{code, status}] } */
export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.email) return NextResponse.json({ courses: [] }, { status: 401 });
  const userId = await ensureUser(req.auth.user.email, req.auth.user.name);
  const rows = (await sql()`
    SELECT code, status FROM plan_courses WHERE user_id = ${userId} ORDER BY code
  `) as { code: string; status: string }[];
  return NextResponse.json({ courses: rows });
});

/**
 * POST /api/plan  body: { code, status: "taken"|"planned" }  -> upsert
 * body: { code, remove: true } -> delete
 * body: { bulk: [{code,status}] } -> merge (localStorage migration)
 */
export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = await ensureUser(req.auth.user.email, req.auth.user.name);
  const body = await req.json();

  const CODE_RE = /^[A-Z]{2,4} \d{4}[A-Z]?$/;

  if (Array.isArray(body.bulk)) {
    for (const item of body.bulk.slice(0, 300)) {
      if (!CODE_RE.test(item.code) || !["taken", "planned"].includes(item.status)) continue;
      await sql()`
        INSERT INTO plan_courses (user_id, code, status) VALUES (${userId}, ${item.code}, ${item.status})
        ON CONFLICT (user_id, code) DO NOTHING
      `;
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof body.code !== "string" || !CODE_RE.test(body.code)) {
    return NextResponse.json({ error: "bad code" }, { status: 400 });
  }
  if (body.remove) {
    await sql()`DELETE FROM plan_courses WHERE user_id = ${userId} AND code = ${body.code}`;
    return NextResponse.json({ ok: true });
  }
  if (!["taken", "planned"].includes(body.status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  await sql()`
    INSERT INTO plan_courses (user_id, code, status) VALUES (${userId}, ${body.code}, ${body.status})
    ON CONFLICT (user_id, code) DO UPDATE SET status = EXCLUDED.status
  `;
  return NextResponse.json({ ok: true });
});
