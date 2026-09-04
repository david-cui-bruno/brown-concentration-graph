import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Graph from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { assembleGraph, sanityCheck } from "./build-graph.js";
import { parsePrereqText } from "./parse-prereqs.js";
import type { ParsedConcentration, PrereqEdge } from "./types.js";

const DATA = fileURLToPath(new URL("../../data/", import.meta.url));
const WEB_PUBLIC = fileURLToPath(new URL("../../web/public/", import.meta.url));

// 1. Load all parsed concentrations.
const concentrations: ParsedConcentration[] = [];
for (const f of readdirSync(DATA + "parsed")) {
  if (f.endsWith(".json"))
    concentrations.push(...JSON.parse(readFileSync(DATA + "parsed/" + f, "utf8")));
}

// 2. Parse prereq texts into edges.
const prereqText: Record<string, { text: string | null; source: string }> = JSON.parse(
  readFileSync(DATA + "prereq-text.json", "utf8")
);
const edges: PrereqEdge[] = [];
const flagged: Record<string, string> = {};
let parsedCount = 0;
for (const [code, v] of Object.entries(prereqText)) {
  if (!v.text) continue;
  const { edges: e, unparsed } = parsePrereqText(code, v.text);
  edges.push(...e);
  if (unparsed) flagged[code] = unparsed;
  else parsedCount++;
}
writeFileSync(DATA + "review/prereq-flagged.json", JSON.stringify(flagged, null, 2));
writeFileSync(DATA + "prereq-edges.json", JSON.stringify(edges, null, 2));

// 3. Assemble + sanity check.
const g = assembleGraph(concentrations, edges);
const report = sanityCheck(g);
console.log("counts:", report.counts);
console.log(`prereq texts fully parsed: ${parsedCount}, flagged: ${Object.keys(flagged).length}`);
if (report.cycles.length) console.warn(`prereq cycles (${report.cycles.length}):`, report.cycles.slice(0, 5));
if (report.errors.length) {
  console.error("SANITY ERRORS:", report.errors.slice(0, 20));
  process.exit(1);
}

// 4. Layout. Simple graph copy for FA2 (multi-edges break it).
const simple = new Graph({ type: "directed" });
g.forEachNode((id, a) => simple.addNode(id, { ...a }));
g.forEachEdge((_, attrs, s, t) => {
  if (s !== t && !simple.hasEdge(s, t)) simple.addEdge(s, t);
});
circular.assign(simple);
forceAtlas2.assign(simple, {
  iterations: 600,
  settings: { scalingRatio: 20, gravity: 0.5, barnesHutOptimize: true, slowDown: 5 },
});

// 5. Export.
const DEPT_HUES = new Map<string, number>();
const hue = (dept: string) => {
  if (!DEPT_HUES.has(dept)) {
    let h = 0;
    for (const ch of dept) h = (h * 31 + ch.charCodeAt(0)) % 360;
    DEPT_HUES.set(dept, h);
  }
  return DEPT_HUES.get(dept)!;
};

/** hsl -> hex, since sigma's WebGL color parser only accepts hex/rgb. */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const nodes = g.mapNodes((id, a) => {
  const pos = simple.getNodeAttributes(id);
  const outDeg = g.outDegree(id);
  const base = {
    id,
    label: a.label as string,
    kind: a.kind as string,
    x: pos.x as number,
    y: pos.y as number,
  };
  if (a.kind === "course") {
    return {
      ...base,
      dept: a.dept,
      size: 2 + Math.log2(1 + outDeg),
      color: hslToHex(hue(a.dept), 52, 74),
      prereqText: prereqText[id]?.text ?? null,
    };
  }
  if (a.kind === "concentration") {
    return { ...base, slug: a.slug, degree: a.degree, size: 9, color: "#f2cd88" };
  }
  return { ...base, groupType: a.groupType, n: a.n ?? null, size: 1.5, color: "#9aa0a6" };
});

const edgeList = g.mapEdges((_, attrs, s, t) => ({
  source: s,
  target: t,
  type: attrs.type as string,
  ...(attrs.kind ? { kind: attrs.kind } : {}),
  ...(attrs.group !== undefined ? { group: attrs.group } : {}),
}));

mkdirSync(WEB_PUBLIC, { recursive: true });
const out = {
  nodes,
  edges: edgeList,
  meta: {
    generatedAt: new Date().toISOString(),
    counts: { ...report.counts, edges: edgeList.length },
  },
};
writeFileSync(WEB_PUBLIC + "graph.json", JSON.stringify(out));
const mb = (JSON.stringify(out).length / 1024 / 1024).toFixed(2);
console.log(`wrote web/public/graph.json (${mb} MB): ${nodes.length} nodes, ${edgeList.length} edges`);
