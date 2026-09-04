# Brown Concentration Graph Explorer — Design

Date: 2026-09-04
Status: Approved in chat (davidcui824), pending spec review

## Purpose

A public website to visually explore which Brown courses serve as prerequisites
for which undergraduate concentrations. Users can search a course, see its
prerequisite chains, see which concentration requirements it fulfills, and mark
courses taken to see what they unlock. Canonical data lives in Neo4j AuraDB;
the public site is served from a static export on Vercel.

Only **official** prerequisites are modeled (no "recommended preparation").

## Data sources

1. **Bulletin concentration pages** — `https://bulletin.brown.edu/the-college/concentrations/<slug>/`
   (~90 pages, listed on /the-college/concentrations/). CourseLeaf requirement
   tables are structured: rows encode "Select one of the following" with a
   count column, `&`-joined course series, indent levels, and named series
   (Series A/B/C). Verified parseable on the CS page.
2. **Prerequisites** — primary: Courses@Brown (CAB) FOSE JSON API
   (`https://cab.brown.edu/api/?page=fose&route=details`). Requires a session
   cookie obtained via headless browser or one manual visit; bare curl returns
   empty. Fallback: bulletin per-course description text containing
   "Prerequisite(s): ...".

## Graph model (Neo4j)

Nodes:
- `Course {code, title, dept}`
- `Concentration {slug, name, degree}` — one node per degree track (AB, ScB)
- `ReqGroup {id, label, type, n}` — `type ∈ {ALL, CHOOSE_N, SERIES}`; `n` for CHOOSE_N

Edges:
- `(Course)-[:PREREQ_OF {kind}]->(Course)` — `kind ∈ {hard, placement}`;
  OR-groups of prerequisites are represented with a `group` property so
  "MATH 0100 or MATH 0170" doesn't read as two independent requirements
- `(Course)-[:FULFILLS]->(ReqGroup)`
- `(ReqGroup)-[:PART_OF]->(ReqGroup|Concentration)` — groups nest
- `(Course)-[:SAME_AS]->(Course)` — cross-listings

Rationale: ReqGroups as first-class nodes make "choose 2 of the following"
and series requirements queryable without double-counting.

## Pipeline (TypeScript, runs locally / CI — never on Vercel)

1. `scrape:concentrations` — fetch and cache all concentration pages,
   parse requirement tables into ReqGroup trees. Unparseable prose sections are
   written to `data/review/needs-review.json` instead of guessed.
2. `scrape:prereqs` — for every course code referenced by any concentration,
   fetch official prereq text (CAB, fallback bulletin), parse into PREREQ_OF
   edges with OR-groups. Unparsed text flagged to the review file.
3. `load:neo4j` — idempotent load into AuraDB (free tier).
4. `export:json` — write `web/public/graph.json` (nodes + edges) committed to repo.

## Website (Next.js, Vercel)

- Loads `graph.json` statically. No runtime DB dependency; Aura pausing never
  breaks the site.
- Visualization: **Sigma.js** (WebGL) with graphology. Color by department,
  node size by out-degree (concentrations unlocked). ForceAtlas2 layout
  computed at build time and baked into the JSON.
- Interactions:
  - Search course → highlight prereq ancestors/descendants + fulfilled ReqGroups.
  - Click concentration → isolate its requirement subtree.
  - "Courses I've taken" panel (localStorage) → satisfied requirements green,
    newly-unlocked courses amber.
- Detail sidebar shows official prereq text verbatim as the source of truth.

## Testing

- Parser unit tests against committed HTML fixtures for CS, Engineering,
  Health & Human Biology, Music, Economics.
- Prereq-text parser table-driven tests (or-groups, series, placement).
- Graph sanity: no orphan ReqGroups, every FULFILLS target exists,
  prereq cycles reported.
- Manual acceptance: deployed Vercel URL renders, search works, CS
  concentration tree correct against the bulletin by hand.

## Known risks

- CAB API auth may require cookie refresh; fallback path covers it.
- ~90% automated prereq parse rate expected; remainder flagged, not guessed.
- Prose-only concentrations get partial coverage, flagged in review file.
- Aura free tier pauses when idle; canonical store only, site unaffected.

## Out of scope

- Recommended/soft prerequisites, WRIT/capstone flags, transfer credit,
  semester availability, user accounts.
