import type Graph from "graphology";

/**
 * A course is "unlocked" by a set of taken courses when every prereq group
 * on it has at least one taken member. Courses with no prereq edges are
 * trivially unlocked (not reported — only newly actionable ones are).
 */
export function unlockedCourses(g: Graph, taken: Set<string>): Set<string> {
  const out = new Set<string>();
  g.forEachNode((id, a) => {
    if (a.kind !== "course" || taken.has(id)) return;
    const groups = new Map<number, boolean>(); // group -> satisfied
    let hasPrereqs = false;
    for (const e of g.inEdges(id)) {
      if (g.getEdgeAttribute(e, "type") !== "PREREQ_OF") continue;
      hasPrereqs = true;
      const grp = (g.getEdgeAttribute(e, "group") as number) ?? 0;
      const satisfied = groups.get(grp) ?? false;
      groups.set(grp, satisfied || taken.has(g.source(e)));
    }
    if (hasPrereqs && [...groups.values()].every(Boolean)) out.add(id);
  });
  return out;
}

/**
 * Approximate progress toward a concentration: satisfied leaf requirements
 * over total required. CHOOSE_N counts min(n, satisfied)/n.
 */
export function concentrationProgress(
  g: Graph,
  concId: string,
  taken: Set<string>
): { satisfied: number; required: number } {
  let satisfied = 0;
  let required = 0;

  const groupMembers = (rgId: string) => {
    const courses: string[] = [];
    const subgroups: string[] = [];
    for (const e of g.inEdges(rgId)) {
      const t = g.getEdgeAttribute(e, "type");
      const src = g.source(e);
      if (t === "FULFILLS") courses.push(src);
      else if (t === "PART_OF") subgroups.push(src);
    }
    return { courses, subgroups };
  };

  const satisfiedIn = (rgId: string): { got: number; need: number } => {
    const a = g.getNodeAttributes(rgId);
    const { courses, subgroups } = groupMembers(rgId);
    const courseHits = courses.filter((c) => taken.has(c)).length;

    if (a.groupType === "SERIES") {
      // all series members needed; counts as 1 requirement
      const need = 1;
      const got = courses.length > 0 && courseHits === courses.length ? 1 : 0;
      return { got, need };
    }
    if (a.groupType === "CHOOSE_N") {
      const n = (a.n as number) || 1;
      let got = courseHits;
      for (const sg of subgroups) {
        const r = satisfiedIn(sg);
        got += r.got >= r.need && r.need > 0 ? 1 : 0;
      }
      return { got: Math.min(n, got), need: n };
    }
    // ALL group
    let got = courseHits;
    let need = courses.length;
    for (const sg of subgroups) {
      const r = satisfiedIn(sg);
      got += r.got;
      need += r.need;
    }
    return { got, need };
  };

  for (const e of g.inEdges(concId)) {
    if (g.getEdgeAttribute(e, "type") !== "PART_OF") continue;
    const r = satisfiedIn(g.source(e));
    satisfied += r.got;
    required += r.need;
  }
  return { satisfied, required };
}
