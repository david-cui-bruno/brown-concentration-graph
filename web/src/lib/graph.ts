import Graph from "graphology";

export interface ExportNode {
  id: string;
  label: string;
  kind: "course" | "concentration" | "reqgroup";
  x: number;
  y: number;
  size: number;
  color: string;
  dept?: string;
  slug?: string;
  degree?: string;
  groupType?: string;
  n?: number | null;
  prereqText?: string | null;
  orbit?: { x: number; y: number; z: number };
  force?: { x: number; y: number; z: number };
}

export interface ExportEdge {
  source: string;
  target: string;
  type: "PREREQ_OF" | "FULFILLS" | "PART_OF" | "SAME_AS";
  kind?: string;
  group?: number;
}

export interface GraphExport {
  nodes: ExportNode[];
  edges: ExportEdge[];
  meta: { generatedAt: string; counts: Record<string, number> };
}

/** Build a graphology graph from the export. Multi-digraph, all edge types. */
export function loadGraph(data: GraphExport): Graph {
  const g = new Graph({ multi: true, type: "directed" });
  for (const n of data.nodes) g.addNode(n.id, { ...n });
  for (const e of data.edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      const { type, ...rest } = e;
      g.addEdge(e.source, e.target, { ...rest, etype: type });
    }
  }
  return g;
}

/** All courses reachable via PREREQ_OF edges from `code`, in the given direction. */
export function prereqClosure(g: Graph, code: string, dir: "up" | "down"): Set<string> {
  const out = new Set<string>();
  if (!g.hasNode(code)) return out;
  const stack = [code];
  while (stack.length) {
    const cur = stack.pop()!;
    const edges = dir === "up" ? g.inEdges(cur) : g.outEdges(cur);
    for (const e of edges) {
      if (g.getEdgeAttribute(e, "etype") !== "PREREQ_OF") continue;
      const next = dir === "up" ? g.source(e) : g.target(e);
      if (!out.has(next) && next !== code) {
        out.add(next);
        stack.push(next);
      }
    }
  }
  return out;
}

/** All nodes (courses + reqgroups) in a concentration's requirement subtree. */
export function concentrationSubtree(g: Graph, concId: string): Set<string> {
  const out = new Set<string>();
  if (!g.hasNode(concId)) return out;
  const stack = [concId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of g.inEdges(cur)) {
      const t = g.getEdgeAttribute(e, "etype");
      if (t !== "PART_OF" && t !== "FULFILLS") continue;
      const src = g.source(e);
      if (!out.has(src)) {
        out.add(src);
        stack.push(src);
      }
    }
  }
  return out;
}

/** Concentrations a course counts toward (walk FULFILLS then PART_OF up). */
export function concentrationsOf(g: Graph, code: string): Set<string> {
  const out = new Set<string>();
  if (!g.hasNode(code)) return out;
  const stack = [code];
  const seen = new Set<string>([code]);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of g.outEdges(cur)) {
      const t = g.getEdgeAttribute(e, "etype");
      if (t !== "FULFILLS" && t !== "PART_OF") continue;
      const tgt = g.target(e);
      if (seen.has(tgt)) continue;
      seen.add(tgt);
      if (g.getNodeAttribute(tgt, "kind") === "concentration") out.add(tgt);
      else stack.push(tgt);
    }
  }
  return out;
}
