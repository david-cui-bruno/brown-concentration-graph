import Graph from "graphology";
import type { ParsedConcentration, PrereqEdge, ReqNode } from "./types.js";

/**
 * Assemble the full multi-digraph:
 *   (Course)-[FULFILLS]->(ReqGroup)-[PART_OF]->(ReqGroup|Concentration)
 *   (Course)-[PREREQ_OF {group, kind}]->(Course)
 */
export function assembleGraph(
  concentrations: ParsedConcentration[],
  prereqs: PrereqEdge[]
): Graph {
  const g = new Graph({ multi: true, type: "directed" });

  const ensureCourse = (code: string) => {
    if (!g.hasNode(code)) {
      g.addNode(code, { kind: "course", label: code, dept: code.split(" ")[0] });
    }
  };

  const usedConcIds = new Map<string, number>();
  for (const conc of concentrations) {
    let concId = `conc:${conc.slug}:${conc.degree.replace(/\s+/g, "-")}`;
    const seen = usedConcIds.get(concId) ?? 0;
    usedConcIds.set(concId, seen + 1);
    let label = `${conc.name} (${conc.degree})`;
    if (seen > 0) {
      concId = `${concId}:${seen + 1}`;
      label = `${conc.name} (${conc.degree} ${seen + 1})`;
    }
    g.addNode(concId, {
      kind: "concentration",
      label,
      slug: conc.slug,
      degree: conc.degree,
    });

    let rgCounter = 0;
    const walk = (node: ReqNode, parentId: string): void => {
      if (node.kind === "course") {
        ensureCourse(node.code);
        g.addEdge(node.code, parentId, { type: "FULFILLS" });
        return;
      }
      if (node.kind === "series") {
        const seriesId = `rg:${concId.slice(5)}:${rgCounter++}`;
        g.addNode(seriesId, {
          kind: "reqgroup",
          label: node.codes.join(" & "),
          groupType: "SERIES",
        });
        g.addEdge(seriesId, parentId, { type: "PART_OF" });
        for (const code of node.codes) {
          ensureCourse(code);
          g.addEdge(code, seriesId, { type: "FULFILLS" });
        }
        return;
      }
      // group
      const rgId = `rg:${concId.slice(5)}:${rgCounter++}`;
      g.addNode(rgId, {
        kind: "reqgroup",
        label: node.label,
        groupType: node.type,
        n: node.n,
      });
      g.addEdge(rgId, parentId, { type: "PART_OF" });
      for (const child of node.children) walk(child, rgId);
    };

    for (const child of conc.root.children) walk(child, concId);
  }

  for (const e of prereqs) {
    // Only add edges between courses that exist in some concentration, plus
    // create missing prereq-only courses (they're real courses students take).
    ensureCourse(e.from);
    ensureCourse(e.to);
    g.addEdge(e.from, e.to, { type: "PREREQ_OF", group: e.group, kind: e.kind });
  }

  return g;
}

export interface SanityReport {
  errors: string[];
  cycles: string[][];
  counts: Record<string, number>;
}

export function sanityCheck(g: Graph): SanityReport {
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  g.forEachNode((_, a) => {
    counts[a.kind] = (counts[a.kind] ?? 0) + 1;
  });

  // Every reqgroup must have exactly one PART_OF out-edge and at least one child.
  g.forEachNode((id, a) => {
    if (a.kind !== "reqgroup") return;
    const partOf = g.outEdges(id).filter((e) => g.getEdgeAttribute(e, "type") === "PART_OF");
    if (partOf.length !== 1) errors.push(`reqgroup ${id} has ${partOf.length} PART_OF edges`);
    const members = g.inEdges(id).filter((e) => {
      const t = g.getEdgeAttribute(e, "type");
      return t === "FULFILLS" || t === "PART_OF";
    });
    if (members.length === 0) errors.push(`reqgroup ${id} is empty`);
  });

  // Cycle detection on PREREQ_OF subgraph (iterative DFS).
  const cycles: string[][] = [];
  const color = new Map<string, number>(); // 0 white, 1 gray, 2 black
  const prereqTargets = (n: string) =>
    g
      .outEdges(n)
      .filter((e) => g.getEdgeAttribute(e, "type") === "PREREQ_OF")
      .map((e) => g.target(e));

  const dfs = (start: string) => {
    const stack: { node: string; path: string[] }[] = [{ node: start, path: [start] }];
    while (stack.length) {
      const { node, path } = stack.pop()!;
      if ((color.get(node) ?? 0) === 2) continue;
      color.set(node, 1);
      let advanced = false;
      for (const t of prereqTargets(node)) {
        const idx = path.indexOf(t);
        if (idx >= 0) {
          cycles.push([...path.slice(idx), t]);
          continue;
        }
        if ((color.get(t) ?? 0) === 0) {
          stack.push({ node: t, path: [...path, t] });
          advanced = true;
        }
      }
      if (!advanced) color.set(node, 2);
    }
  };
  g.forEachNode((id, a) => {
    if (a.kind === "course" && (color.get(id) ?? 0) === 0) dfs(id);
  });

  return { errors, cycles, counts };
}
