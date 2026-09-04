import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchCached, type ConcentrationRef } from "./fetch.js";
import { parseConcentration } from "./parse-requirements.js";
import type { ParsedConcentration, ReqNode } from "./types.js";

const DATA = fileURLToPath(new URL("../../data/", import.meta.url));
const refs: ConcentrationRef[] = JSON.parse(readFileSync(DATA + "concentrations.json", "utf8"));

mkdirSync(DATA + "parsed", { recursive: true });
mkdirSync(DATA + "review", { recursive: true });

const review: Record<string, string[]> = {};
const allCourses = new Set<string>();
let tableCount = 0;

const countCourses = (n: ReqNode) => {
  if (n.kind === "course") allCourses.add(n.code);
  else if (n.kind === "series") n.codes.forEach((c) => allCourses.add(c));
  else n.children.forEach(countCourses);
};

for (const ref of refs) {
  const html = await fetchCached(ref.url);
  let parsed: ParsedConcentration[] = [];
  try {
    parsed = parseConcentration(ref.slug, ref.name, html);
  } catch (e) {
    review[ref.slug] = [`PARSE ERROR: ${e}`];
    continue;
  }
  writeFileSync(DATA + `parsed/${ref.slug}.json`, JSON.stringify(parsed, null, 2));
  const unparsed = parsed.flatMap((p) => p.unparsed);
  if (unparsed.length) review[ref.slug] = unparsed;
  parsed.forEach((p) => countCourses(p.root));
  tableCount += parsed.length;
}

writeFileSync(DATA + "review/needs-review.json", JSON.stringify(review, null, 2));
writeFileSync(DATA + "courses.json", JSON.stringify([...allCourses].sort(), null, 2));

console.log(`concentrations: ${refs.length}`);
console.log(`requirement tables parsed: ${tableCount}`);
console.log(`distinct courses referenced: ${allCourses.size}`);
console.log(
  `pages with flagged rows: ${Object.keys(review).length} (${Object.values(review).flat().length} rows)`
);
