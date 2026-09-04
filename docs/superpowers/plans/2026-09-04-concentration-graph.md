# Brown Concentration Graph Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pipeline that scrapes Brown bulletin concentrations + official prerequisites into Neo4j and a static JSON export, plus a Next.js + Sigma.js site on Vercel to explore the graph.

**Architecture:** Two packages in one repo. `pipeline/` (Node/TS scripts) scrapes bulletin concentration tables and CAB/bulletin prereq text, builds a typed graph, loads Neo4j AuraDB, and exports `web/public/graph.json` with a precomputed layout. `web/` (Next.js) renders the JSON with Sigma.js and client-side interactions only.

**Tech Stack:** TypeScript, Node 20+, cheerio (HTML parsing), playwright (CAB session cookie), neo4j-driver, graphology + graphology-layout-forceatlas2, Next.js 14 (app router), Sigma.js v3, vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-concentration-graph-design.md`

## Global Constraints

- Only **official** prerequisites; recommended prep is ignored everywhere.
- Unparseable requirement/prereq text goes to `data/review/needs-review.json`, never guessed.
- All HTTP fetches are cached to `data/cache/` on first run; parsers read from cache so tests and re-runs never hammer brown.edu.
- Course codes normalized as `DEPT NNNN` with a single space, e.g. `CSCI 0150`.
- The website must have zero runtime dependency on Neo4j.
- Commit after every task.

---

### Task 1: Repo scaffolding

**Files:**
- Create: `package.json` (workspaces), `pipeline/package.json`, `pipeline/tsconfig.json`, `.gitignore`, `pipeline/vitest.config.ts`

**Interfaces:**
- Produces: `pnpm -C pipeline test` runs vitest; `pnpm -C pipeline tsx src/<script>.ts` runs scripts.

- [ ] **Step 1: Scaffold**

```bash
cd ~/brown-concentration-graph
printf '{ "private": true, "workspaces": ["pipeline", "web"] }\n' > package.json
mkdir -p pipeline/src pipeline/test data/cache data/review
cd pipeline
npm init -y
npm i cheerio neo4j-driver graphology graphology-layout-forceatlas2 graphology-layout
npm i -D typescript tsx vitest @types/node playwright
npx tsc --init --target es2022 --module nodenext --moduleResolution nodenext --strict --outDir dist
printf 'node_modules\ndist\ndata/cache\n.env\n' > ../.gitignore
```

- [ ] **Step 2: Smoke test**

Create `pipeline/test/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("smoke", () => expect(1 + 1).toBe(2));
```
Run: `npx vitest run` → PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "chore: scaffold pipeline workspace"`

---

### Task 2: Fetch-and-cache helper + concentration index scraper

**Files:**
- Create: `pipeline/src/fetch.ts`, `pipeline/src/scrape-index.ts`
- Test: `pipeline/test/fetch.test.ts`

**Interfaces:**
- Produces: `fetchCached(url: string): Promise<string>` — returns body, caches to `data/cache/<sha1(url)>.html`.
- Produces: `scrapeIndex(): Promise<{slug: string; name: string; url: string}[]>` and writes `data/concentrations.json`.

- [ ] **Step 1: Write failing test**

```ts
import { expect, test } from "vitest";
import { cachePath, parseIndex } from "../src/fetch.js";
import { readFileSync } from "node:fs";

test("cachePath is deterministic", () => {
  expect(cachePath("https://x.com/a")).toBe(cachePath("https://x.com/a"));
});

test("parseIndex extracts concentration links", () => {
  const html = readFileSync("test/fixtures/index.html", "utf8");
  const rows = parseIndex(html);
  expect(rows.length).toBeGreaterThan(80);
  expect(rows.find(r => r.slug === "comp")).toMatchObject({ name: "Computer Science" });
});
```

- [ ] **Step 2: Save fixture** — `curl -s https://bulletin.brown.edu/the-college/concentrations/ > pipeline/test/fixtures/index.html`

- [ ] **Step 3: Run test, verify FAIL** (`parseIndex not defined`)

- [ ] **Step 4: Implement**

```ts
// fetch.ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as cheerio from "cheerio";

const CACHE = new URL("../../data/cache/", import.meta.url).pathname;

export function cachePath(url: string): string {
  return CACHE + createHash("sha1").update(url).digest("hex") + ".html";
}

export async function fetchCached(url: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const p = cachePath(url);
  if (existsSync(p)) return readFileSync(p, "utf8");
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (concentration-graph)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const body = await res.text();
  writeFileSync(p, body);
  await new Promise(r => setTimeout(r, 500)); // be polite
  return body;
}

export function parseIndex(html: string): { slug: string; name: string; url: string }[] {
  const $ = cheerio.load(html);
  const out: { slug: string; name: string; url: string }[] = [];
  $('a[href^="/the-college/concentrations/"]').each((_, a) => {
    const href = $(a).attr("href")!;
    const m = href.match(/^\/the-college\/concentrations\/([a-z]+)\/$/);
    if (m) out.push({ slug: m[1], name: $(a).text().trim(), url: `https://bulletin.brown.edu${href}` });
  });
  return [...new Map(out.map(r => [r.slug, r])).values()];
}
```

`scrape-index.ts` calls `fetchCached` + `parseIndex`, writes `data/concentrations.json`.

- [ ] **Step 5: Run test, verify PASS. Run `npx tsx src/scrape-index.ts`, verify ~90 entries.**

- [ ] **Step 6: Commit** — `feat: concentration index scraper with caching`

---

### Task 3: Requirement-table parser (the core)

**Files:**
- Create: `pipeline/src/types.ts`, `pipeline/src/parse-requirements.ts`
- Test: `pipeline/test/parse-requirements.test.ts`, fixtures for comp, engn, hhbi, musc, econ

**Interfaces:**
- Produces (types.ts):
```ts
export type ReqNode =
  | { kind: "group"; label: string; type: "ALL" | "CHOOSE_N" | "SERIES"; n?: number; children: ReqNode[] }
  | { kind: "course"; code: string }          // "CSCI 0150"
  | { kind: "series"; codes: string[] };      // CSCI 0150 & CSCI 0200
export interface ParsedConcentration {
  slug: string; name: string; degree: string; // "AB" | "ScB" | "unified"
  root: ReqNode; unparsed: string[];          // flagged prose rows
}
```
- Produces: `parseConcentration(slug: string, name: string, html: string): ParsedConcentration[]` (one per degree table).

CourseLeaf table semantics (verified on comp): `table.sc_courselist` rows; `td.codecol` holds codes (`&#160;` separators, `&` for series); rows with class `areaheader`/`areasubheader` are group labels; comment rows like "Select one of the following:" with a `hourscol` count open a CHOOSE_N group; `orclass` rows attach OR-alternatives to the previous row; indent via `blockindent` class.

- [ ] **Step 1: Save fixtures**

```bash
for s in comp engn hhbi musc econ; do
  curl -s "https://bulletin.brown.edu/the-college/concentrations/$s/" > pipeline/test/fixtures/$s.html
done
```

- [ ] **Step 2: Write failing tests**

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseConcentration } from "../src/parse-requirements.js";

const load = (s: string) => readFileSync(`test/fixtures/${s}.html`, "utf8");

test("comp ScB has intro series CHOOSE group", () => {
  const tables = parseConcentration("comp", "Computer Science", load("comp"));
  expect(tables.length).toBeGreaterThanOrEqual(2); // AB + ScB
  const scb = tables.find(t => t.degree === "ScB")!;
  const json = JSON.stringify(scb.root);
  expect(json).toContain('"CSCI 0150"');
  expect(json).toContain('"type":"CHOOSE_N"');
});

test("or-alternatives group MATH 0100/0170/0190 together", () => {
  const t = parseConcentration("comp", "Computer Science", load("comp"))[0];
  const groups = JSON.stringify(t.root);
  // 0100 and 0170 must be siblings under one CHOOSE_N(1) group
  expect(groups).toMatch(/MATH 0100.*MATH 0170/s);
});

test("series rows become series nodes", () => {
  const scb = parseConcentration("comp", "Computer Science", load("comp"))
    .find(t => t.degree === "ScB")!;
  const found = JSON.stringify(scb.root).includes('"kind":"series"');
  expect(found).toBe(true);
});

test("prose-heavy pages flag unparsed rows instead of throwing", () => {
  const t = parseConcentration("musc", "Music", load("musc"));
  expect(t.length).toBeGreaterThan(0); // no throw; unparsed[] may be non-empty
});
```

- [ ] **Step 3: Run tests, verify FAIL**

- [ ] **Step 4: Implement `parse-requirements.ts`**

Walk each `table.sc_courselist`. Maintain a group stack. Per row:
1. `areaheader`/`areasubheader` → close deeper groups, push `{type:"ALL", label}`.
2. Comment row matching `/select (one|two|three|\d+)/i` with hours cell → push `{type:"CHOOSE_N", n}` (map words→numbers; hours cell count wins when numeric).
3. `codecol` with `&` → `{kind:"series", codes}` (normalize NBSP → space).
4. `orclass` row → wrap previous leaf and this one in a `CHOOSE_N n=1` group (create if not already inside one).
5. Row with text but no code → push text to `unparsed[]`.
Determine `degree` per table from nearest preceding heading matching /A\.B\.|Sc\.B\.|Standard/ else `"unified"`. Normalize codes with `code.replace(/\u00a0/g," ").trim()`.

Full implementation ~150 lines; keep it one file, pure function of HTML string.

- [ ] **Step 5: Run tests until PASS. Then run against ALL cached pages** (`npx tsx src/scrape-all.ts` — small driver that loops `data/concentrations.json`, writes `data/parsed/<slug>.json` and aggregates `data/review/needs-review.json`). Print summary: pages parsed, courses referenced, unparsed row count.

- [ ] **Step 6: Commit** — `feat: requirement table parser with fixtures for 5 concentrations`

---

### Task 4: Prereq fetcher (CAB primary, bulletin fallback)

**Files:**
- Create: `pipeline/src/cab.ts`, `pipeline/src/scrape-prereqs.ts`
- Test: `pipeline/test/cab.test.ts` (parsing only; network code untested)

**Interfaces:**
- Produces: `getPrereqText(code: string): Promise<{ code: string; text: string | null; source: "cab" | "bulletin" }>`
- Produces: `data/prereq-text.json` — `{ [code]: { text, source } }` for every course referenced in `data/parsed/*.json`.

- [ ] **Step 1: CAB session via playwright**

```ts
// cab.ts — getCabSession(): launch chromium headless, goto https://cab.brown.edu,
// wait for network idle, extract cookies + the current srcdb from page context
// (window.JSON blob or the term <select>). Return { cookieHeader, srcdb }.
// Then getCabDetails(code, session): POST /api/?page=fose&route=details with
// {"group":"code:CSCI 0150","key":"","srcdb":srcdb} and cookie header.
// Field of interest in response: registration_restrictions / prerequisites HTML → strip tags.
```

- [ ] **Step 2: Bulletin fallback** — bulletin department course pages (`https://bulletin.brown.edu/search/?P=CSCI+0150`) contain course blocks with "Prerequisite(s): …" text. Parse with cheerio: find `.courseblock` containing the code, extract sentence starting "Prerequisite".

- [ ] **Step 3: Test the extraction functions with saved JSON/HTML fixtures** (one CAB details response captured manually via the playwright session, one bulletin search page). Verify FAIL → implement → PASS.

- [ ] **Step 4: Run `npx tsx src/scrape-prereqs.ts`.** It must: dedupe course codes across all parsed concentrations, try CAB, fall back to bulletin, write nulls for courses with no prereq text (that's valid: most intro courses have none). Log counts per source. If CAB auth fails entirely, proceed bulletin-only and print a warning (user can provide an authenticated session later; do not block).

- [ ] **Step 5: Commit** — `feat: official prereq text scraper (CAB + bulletin fallback)`

---

### Task 5: Prereq text parser

**Files:**
- Create: `pipeline/src/parse-prereqs.ts`
- Test: `pipeline/test/parse-prereqs.test.ts`

**Interfaces:**
- Produces:
```ts
export interface PrereqEdge { from: string; to: string; group: number; kind: "hard" | "placement" }
export function parsePrereqText(code: string, text: string):
  { edges: PrereqEdge[]; unparsed: string | null }
```
OR-alternatives share a `group` number (per target course). "placement" kind when text matches /place(ment)? out|equivalent placement/.

- [ ] **Step 1: Table-driven failing tests**

```ts
const cases = [
  ["CSCI 0200", "Prerequisite: CSCI 0150 or CSCI 0170.",
    [{ from: "CSCI 0150", to: "CSCI 0200", group: 0 }, { from: "CSCI 0170", to: "CSCI 0200", group: 0 }]],
  ["MATH 0180", "Prerequisite: MATH 0100, MATH 0170, or MATH 0190.",
    3 /* edges, all group 0 */],
  ["CSCI 1410", "Prerequisites: CSCI 0200 and (MATH 0520 or MATH 0540).",
    3 /* CSCI0200 group 0; MATHs group 1 */],
  ["ECON 1110", "Prerequisite: ECON 0110 or equivalent placement.",
    "placement kind on edge"],
  ["APMA 1650", "Instructor permission required.", "unparsed, zero edges"],
] as const;
```
Assert edge sets, group numbers, kinds; last case asserts `unparsed !== null`.

- [ ] **Step 2: Run, verify FAIL**

- [ ] **Step 3: Implement.** Tokenize course codes with `/([A-Z]{2,4})\s?0?(\d{3,4}[A-Z]?)/g` (carry forward dept for bare numbers like "MATH 0100 or 0170"). Split on "and" / ";" for group boundaries; "or" / "," within a group. Any leftover alphabetic content beyond stopwords ("prerequisite", "or", "and", "equivalent", …) → set `unparsed` to the raw text AND still emit whatever edges were confidently found.

- [ ] **Step 4: PASS, then run over `data/prereq-text.json` → `data/prereq-edges.json` + review file entries. Print parse rate.**

- [ ] **Step 5: Commit** — `feat: prereq text parser with or-group semantics`

---

### Task 6: Graph assembly, sanity checks, JSON export with layout

**Files:**
- Create: `pipeline/src/build-graph.ts`, `pipeline/src/export-json.ts`
- Test: `pipeline/test/build-graph.test.ts`

**Interfaces:**
- Produces `web/public/graph.json`:
```ts
interface GraphExport {
  nodes: { id: string; label: string; kind: "course" | "concentration" | "reqgroup";
           dept?: string; degree?: string; groupType?: string; n?: number;
           x: number; y: number; size: number; color: string }[];
  edges: { source: string; target: string; type: "PREREQ_OF" | "FULFILLS" | "PART_OF" | "SAME_AS";
           kind?: string; group?: number }[];
  meta: { generatedAt: string; counts: Record<string, number> };
}
```
Node ids: courses = code; concentrations = `conc:<slug>:<degree>`; reqgroups = `rg:<slug>:<degree>:<path>`.

- [ ] **Step 1: Failing tests** — build a tiny in-memory ParsedConcentration + edges, assert: every FULFILLS target exists; no orphan reqgroups; cycle detection reports a planted `A→B→A`; cross-listed codes in bulletin (`CSCI 0150/APMA...` in codecol handled in Task 3 as SAME_AS pairs) merge to one node with SAME_AS edge.

- [ ] **Step 2: FAIL → implement.** Use graphology; sanity failures print and exit 1 (cycles: warn only, prereq data has legit odd cases; orphans: error). Layout: `circular` seed then `forceatlas2.assign(graph, {iterations: 500, settings: {scalingRatio: 10, gravity: 1}})`. Size = 2 + log2(1 + outDegree). Color: hash dept → HSL palette; concentrations gold; reqgroups gray, small.

- [ ] **Step 3: PASS → run full export. Check `graph.json` < 5 MB (if larger, drop reqgroup labels into a lookup table).**

- [ ] **Step 4: Commit** — `feat: graph assembly, sanity checks, layout export`

---

### Task 7: Neo4j AuraDB loader

**Files:**
- Create: `pipeline/src/load-neo4j.ts`, `.env.example` (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`)

**Interfaces:**
- Consumes `graph.json`. Idempotent: `MERGE` on node ids, constraint `CREATE CONSTRAINT course_code IF NOT EXISTS FOR (c:Course) REQUIRE c.code IS UNIQUE` (same for Concentration.slug+degree via composite key property, ReqGroup.id).

- [ ] **Step 1: User setup gate** — ask user to create a free AuraDB at console.neo4j.io and paste URI/password into `pipeline/.env`. If user defers, skip this task and continue (site doesn't depend on it); leave todo open.

- [ ] **Step 2: Implement loader** — batch `UNWIND $rows` MERGE queries per node kind, then per edge type. Run, then verify with `MATCH (n) RETURN labels(n)[0], count(*)` printed to console matching `meta.counts`.

- [ ] **Step 3: Commit** — `feat: idempotent neo4j aura loader`

---

### Task 8: Next.js site with Sigma.js full-map view

**Files:**
- Create: `web/` via `npx create-next-app@latest web --ts --app --no-tailwind --eslint --src-dir`
- Create: `web/src/app/page.tsx`, `web/src/components/GraphView.tsx`, `web/src/lib/graph.ts`
- `npm -C web i sigma graphology @react-sigma/core`

**Interfaces:**
- `lib/graph.ts`: `loadGraph(data: GraphExport): Graph` (graphology instance) + typed accessors used by Task 9 (`prereqClosure(g, code, dir: "up"|"down"): Set<string>`, `concentrationSubtree(g, concId): Set<string>`).

- [ ] **Step 1:** GraphView client component: `SigmaContainer` rendering the graphology graph from `/graph.json` (fetched client-side, positions pre-baked so no layout cost). Node reducer: dim non-highlighted when a selection exists. ReqGroup nodes hidden by default (they're plumbing); FULFILLS edges drawn course→concentration transitively for display (compute display edges in `lib/graph.ts`, keep the true structure for logic).
- [ ] **Step 2:** Verify `npm run dev` renders the full map, pan/zoom smooth, hover shows label.
- [ ] **Step 3: Commit** — `feat: next.js sigma full-map view`

(Note: display-edge flattening: for each course with FULFILLS path to a concentration, one light edge course→concentration. Cap at courses that directly appear in that concentration's tables.)

- [ ] **Step 4:** vitest for `prereqClosure` and `concentrationSubtree` on a small fixture graph → PASS → commit.

---

### Task 9: Interactions

**Files:**
- Create: `web/src/components/SearchBox.tsx`, `web/src/components/SidePanel.tsx`, `web/src/components/TakenPanel.tsx`
- Modify: `web/src/components/GraphView.tsx`

**Interfaces:**
- Consumes `prereqClosure`, `concentrationSubtree` from Task 8.

- [ ] **Step 1: Search** — typeahead over node labels+ids; selecting a course highlights `prereqClosure(up) ∪ prereqClosure(down)` plus concentrations it fulfills; side panel shows title, dept, official prereq text verbatim (include `prereqText` per course node in export — add in Task 6 if missed), and list of concentrations/groups it fulfills.
- [ ] **Step 2: Concentration isolate** — clicking a concentration node (or picking from a list drawer) filters the view to `concentrationSubtree`; reqgroups render as small labeled hubs in this mode ("choose 2").
- [ ] **Step 3: Taken courses** — TakenPanel: multiselect stored in localStorage. Satisfied courses green; courses whose prereq groups are now fully satisfiable amber ("unlocked"); per-concentration progress = satisfied leaves / required (approximate for CHOOSE_N: min(n, satisfied)).
- [ ] **Step 4:** Unit tests for the unlock computation (`web/src/lib/unlock.ts`, pure function, vitest): given edges with or-groups, taking `CSCI 0150` unlocks `CSCI 0200` but taking nothing doesn't. PASS.
- [ ] **Step 5: Commit** — `feat: search, isolate, taken-courses interactions`

---

### Task 10: Deploy to Vercel + acceptance

**Files:**
- Create: `web/vercel.json` (none needed likely), `README.md`

- [ ] **Step 1:** `npm -C web run build` passes clean.
- [ ] **Step 2:** `npx vercel --cwd web` (user may need to auth vercel CLI once) → then `npx vercel --prod`.
- [ ] **Step 3: Acceptance against live URL:** map renders; search "CSCI 0200" shows CSCI 0150/0170 as prereqs; Computer Science ScB isolate matches bulletin page by hand; taken=[MATH 0100, CSCI 0150] shows CSCI 0200 unlocked.
- [ ] **Step 4:** README: what it is, data sources + caveats (official prereqs only, review-file coverage gaps), how to re-run pipeline, how to load Neo4j.
- [ ] **Step 5: Commit + push** (create GitHub repo if user wants).

## Self-review notes

- Spec coverage: model→T3/T6, pipeline→T2-6, neo4j→T7, site→T8-9, testing→each task + T10 acceptance, risks→T4 fallback + review files. Covered.
- Cross-listing (SAME_AS) extraction happens in Task 3 codecol parsing (codes separated by `/`), consumed in Task 6 merge. Type names consistent: `ReqNode`, `PrereqEdge`, `GraphExport`.
