# Brown Concentration Graph

Interactive map of Brown University undergraduate concentrations, their
requirement structures, and official course prerequisites.

**Unofficial student project.** Always confirm requirements against the
[Brown Bulletin](https://bulletin.brown.edu) and your concentration advisor.

## What it shows

- ~2,000 courses and 168 concentration requirement tables from the 2026-27 bulletin
- Official prerequisites from [Courses@Brown](https://cab.brown.edu) (registration restrictions)
- Search any course: its prereq chain, what it unlocks, which concentrations it counts toward
- Click a concentration: isolate its requirement tree
- "My courses": mark courses taken, see what's unlocked and per-concentration progress

## Structure

- `pipeline/` — TypeScript scrapers and graph builder
  - `scrape-index.ts` → `data/concentrations.json`
  - `scrape-all.ts` → `data/parsed/*.json` (requirement trees) + review flags
  - `scrape-prereqs.ts` → `data/prereq-text.json` (CAB, via headless browser)
  - `export-json.ts` → `web/public/graph.json` (with ForceAtlas2 layout baked in)
  - `load-neo4j.ts` → optional Neo4j AuraDB load (see `.env.example`)
- `web/` — Next.js + Sigma.js site, fully static, no runtime DB
- `docs/superpowers/` — design spec and implementation plan

## Rebuilding the data

```bash
cd pipeline
npx tsx src/scrape-index.ts
npx tsx src/scrape-all.ts
npx tsx src/scrape-prereqs.ts   # ~25 min, cached and resumable
npx tsx src/export-json.ts
```

## Known caveats

- Only **official** prerequisites are modeled. Recommended prep is excluded by design.
- AP/IB score alternatives and permission-based requirements can't be edges;
  those texts are flagged in `data/review/` and shown verbatim in the UI.
- Courses not offered since ~2023 have no CAB entry and show no prereqs.
- Prose-heavy concentration pages (e.g. Music) have partial coverage; unparsed
  rows are listed in `data/review/needs-review.json`.

## Tests

```bash
cd pipeline && npx vitest run   # parsers, graph assembly
cd web && npx vitest run        # graph lib, unlock logic
```
