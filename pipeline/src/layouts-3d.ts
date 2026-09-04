/**
 * Compute two alternative 3D layouts and add them to graph.json:
 *   orbit:  concentrations spread on a sphere-ish shell; courses positioned by
 *           weighted average of the concentrations they feed (+ jitter), with
 *           height = prereq depth (longest chain from a no-prereq course).
 *   force:  pure 3D force simulation (d3-force-3d), organic galaxy look.
 *
 * Output: each node gets { orbit: {x,y,z}, force: {x,y,z} } alongside the
 * existing 2D x/y (kept for the "level" layout height variant).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
} from "d3-force-3d";

const WEB = fileURLToPath(new URL("../../web/public/", import.meta.url));
const data = JSON.parse(readFileSync(WEB + "graph.json", "utf8"));

interface N {
  id: string;
  kind: string;
  [k: string]: unknown;
}
const nodes: N[] = data.nodes;
const edges: { source: string; target: string; type: string }[] = data.edges;
const byId = new Map(nodes.map((n) => [n.id, n]));

// ---------- shared: prereq depth ----------
const prereqIn = new Map<string, string[]>(); // course -> its prereqs
for (const e of edges) {
  if (e.type !== "PREREQ_OF") continue;
  (prereqIn.get(e.target) ?? prereqIn.set(e.target, []).get(e.target)!).push(e.source);
}
const depthMemo = new Map<string, number>();
function depth(id: string, seen = new Set<string>()): number {
  if (depthMemo.has(id)) return depthMemo.get(id)!;
  if (seen.has(id)) return 0; // cycle guard
  seen.add(id);
  const ins = prereqIn.get(id);
  const d = ins && ins.length ? 1 + Math.max(...ins.map((p) => depth(p, seen))) : 0;
  depthMemo.set(id, d);
  return d;
}
for (const n of nodes) if (n.kind === "course") depth(n.id);
const maxDepth = Math.max(1, ...depthMemo.values());

// ---------- orbit layout ----------
// concentration -> set of course ids that fulfill it (direct FULFILLS through groups)
const partOf = new Map<string, string>(); // group -> parent
for (const e of edges) if (e.type === "PART_OF") partOf.set(e.source, e.target);
const concOf = (groupId: string): string | null => {
  let cur: string | undefined = groupId;
  let guard = 0;
  while (cur && guard++ < 12) {
    if (cur.startsWith("conc:")) return cur;
    cur = partOf.get(cur);
  }
  return null;
};
const courseConcs = new Map<string, Set<string>>();
for (const e of edges) {
  if (e.type !== "FULFILLS") continue;
  const conc = concOf(e.target);
  if (!conc) continue;
  (courseConcs.get(e.source) ?? courseConcs.set(e.source, new Set()).get(e.source)!).add(conc);
}

// Place concentrations on a golden-spiral ring (radius varies slightly) at high y.
const concs = nodes.filter((n) => n.kind === "concentration");
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const concPos = new Map<string, { x: number; z: number }>();
concs.forEach((c, i) => {
  const r = 300 + 90 * Math.sin(i * 2.4); // two loose rings
  const a = i * GOLDEN;
  concPos.set(c.id, { x: r * Math.cos(a), z: r * Math.sin(a) });
});

// deterministic jitter from id hash
const jitter = (id: string, mag: number) => {
  let h = 2166136261;
  for (const ch of id) h = (h ^ ch.charCodeAt(0)) * 16777619;
  const a = ((h >>> 0) % 6283) / 1000;
  const m = (((h >>> 8) % 1000) / 1000) * mag;
  return { dx: m * Math.cos(a), dz: m * Math.sin(a) };
};

const ORBIT_HEIGHT = 200;
for (const n of nodes) {
  if (n.kind === "concentration") {
    const p = concPos.get(n.id)!;
    (n as any).orbit = { x: p.x, y: ORBIT_HEIGHT, z: p.z };
  } else if (n.kind === "reqgroup") {
    const conc = concOf(n.id);
    const p = conc ? concPos.get(conc) : null;
    const j = jitter(n.id, 40);
    (n as any).orbit = p
      ? { x: p.x + j.dx, y: ORBIT_HEIGHT - 30, z: p.z + j.dz }
      : { x: j.dx * 10, y: ORBIT_HEIGHT - 30, z: j.dz * 10 };
  } else {
    const concsFor = courseConcs.get(n.id);
    const d = depthMemo.get(n.id) ?? 0;
    const y = 20 + (d / maxDepth) * 130; // prereq depth as height
    if (concsFor && concsFor.size) {
      let x = 0, z = 0;
      for (const c of concsFor) {
        const p = concPos.get(c)!;
        x += p.x;
        z += p.z;
      }
      x /= concsFor.size;
      z /= concsFor.size;
      // shared courses drift toward center naturally (average); jitter to avoid stacking
      const j = jitter(n.id, 34 + 10 * concsFor.size);
      (n as any).orbit = { x: x * 0.82 + j.dx, y, z: z * 0.82 + j.dz };
    } else {
      // prereq-only courses: average of the courses they unlock
      const outs = edges.filter((e) => e.type === "PREREQ_OF" && e.source === n.id);
      let x = 0, z = 0, k = 0;
      for (const e of outs) {
        const t = (byId.get(e.target) as any)?.orbit;
        if (t) { x += t.x; z += t.z; k++; }
      }
      const j = jitter(n.id, 60);
      (n as any).orbit = k
        ? { x: x / k + j.dx, y, z: z / k + j.dz }
        : { x: j.dx * 14, y, z: j.dz * 14 };
    }
  }
}

// ---------- force layout ----------
const simNodes = nodes.map((n) => ({ id: n.id, kind: n.kind }));
const simLinks = edges
  .filter((e) => e.type === "PREREQ_OF" || e.type === "FULFILLS")
  .map((e) => ({ source: e.source, target: e.target, w: e.type === "PREREQ_OF" ? 2 : 0.5 }));

console.log("running 3D force simulation…");
const sim = forceSimulation(simNodes, 3)
  .force("charge", forceManyBody().strength(-24))
  .force("link", forceLink(simLinks).id((d: any) => d.id).strength((l: any) => (l.w === 2 ? 0.5 : 0.08)).distance(28))
  .force("center", forceCenter(0, 0, 0))
  .force("collide", forceCollide(5))
  .stop();
for (let i = 0; i < 250; i++) {
  sim.tick();
  if (i % 50 === 0) console.log(`  tick ${i}/250`);
}
const SCALE = 1.35;
for (const sn of simNodes as any[]) {
  const n = byId.get(sn.id)! as any;
  n.force = { x: sn.x * SCALE, y: sn.y * SCALE, z: sn.z * SCALE };
}

data.meta.layouts = ["level", "orbit", "force"];
writeFileSync(WEB + "graph.json", JSON.stringify(data));
const mb = (JSON.stringify(data).length / 1048576).toFixed(2);
console.log(`updated graph.json (${mb} MB) with orbit + force layouts; maxDepth=${maxDepth}`);
