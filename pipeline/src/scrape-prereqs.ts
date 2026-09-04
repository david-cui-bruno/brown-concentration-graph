import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CabSession } from "./cab.js";

const DATA = fileURLToPath(new URL("../../data/", import.meta.url));
const OUT = DATA + "prereq-text.json";

const courses: string[] = JSON.parse(readFileSync(DATA + "courses.json", "utf8"));
// Resume support: keep already-fetched entries.
const existing: Record<string, { text: string | null; source: string; srcdb: string | null }> =
  existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const todo = courses.filter((c) => !(c in existing));
console.log(`courses total=${courses.length} todo=${todo.length}`);

const session = new CabSession();
await session.open();

let done = 0;
let found = 0;
for (const code of todo) {
  try {
    const r = await session.lookup(code);
    existing[code] = { text: r.text, source: r.srcdb ? "cab" : "none", srcdb: r.srcdb };
    if (r.text) found++;
  } catch (e) {
    console.error(`ERROR ${code}: ${e}`);
    existing[code] = { text: null, source: "error", srcdb: null };
  }
  done++;
  if (done % 25 === 0) {
    writeFileSync(OUT, JSON.stringify(existing, null, 2));
    console.log(`JCODE_PROGRESS {"done":${done},"total":${todo.length},"withPrereqs":${found}}`);
  }
  await new Promise((r) => setTimeout(r, 150));
}
writeFileSync(OUT, JSON.stringify(existing, null, 2));
await session.close();

const stats = { total: courses.length, withText: 0, noneListed: 0, notFound: 0, errors: 0 };
for (const v of Object.values(existing)) {
  if (v.text) stats.withText++;
  else if (v.source === "cab") stats.noneListed++;
  else if (v.source === "error") stats.errors++;
  else stats.notFound++;
}
console.log(JSON.stringify(stats, null, 2));
