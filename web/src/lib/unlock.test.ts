import { describe, expect, test } from "vitest";
import { loadGraph, type GraphExport } from "./graph";
import { unlockedCourses, concentrationProgress } from "./unlock";

const fixture: GraphExport = {
  nodes: [
    { id: "CSCI 0150", label: "CSCI 0150", kind: "course", x: 0, y: 0, size: 2, color: "#000" },
    { id: "CSCI 0170", label: "CSCI 0170", kind: "course", x: 0, y: 0, size: 2, color: "#000" },
    { id: "CSCI 0200", label: "CSCI 0200", kind: "course", x: 0, y: 0, size: 2, color: "#000" },
    { id: "MATH 0520", label: "MATH 0520", kind: "course", x: 0, y: 0, size: 2, color: "#000" },
    { id: "CSCI 1410", label: "CSCI 1410", kind: "course", x: 0, y: 0, size: 2, color: "#000" },
    { id: "rg:c:ScB:0", label: "core", kind: "reqgroup", groupType: "CHOOSE_N", n: 1, x: 0, y: 0, size: 1, color: "#999" },
    { id: "conc:c:ScB", label: "C (ScB)", kind: "concentration", x: 0, y: 0, size: 9, color: "#eb0" },
  ],
  edges: [
    // CSCI 0200 needs 0150 or 0170 (one group)
    { source: "CSCI 0150", target: "CSCI 0200", type: "PREREQ_OF", group: 0 },
    { source: "CSCI 0170", target: "CSCI 0200", type: "PREREQ_OF", group: 0 },
    // CSCI 1410 needs 0200 AND MATH 0520 (two groups)
    { source: "CSCI 0200", target: "CSCI 1410", type: "PREREQ_OF", group: 0 },
    { source: "MATH 0520", target: "CSCI 1410", type: "PREREQ_OF", group: 1 },
    // concentration: choose 1 of {0150, 0170}
    { source: "CSCI 0150", target: "rg:c:ScB:0", type: "FULFILLS" },
    { source: "CSCI 0170", target: "rg:c:ScB:0", type: "FULFILLS" },
    { source: "rg:c:ScB:0", target: "conc:c:ScB", type: "PART_OF" },
  ],
  meta: { generatedAt: "", counts: {} },
};

describe("unlock", () => {
  const g = loadGraph(fixture);

  test("taking CSCI 0150 unlocks CSCI 0200 but not CSCI 1410", () => {
    const u = unlockedCourses(g, new Set(["CSCI 0150"]));
    expect(u.has("CSCI 0200")).toBe(true);
    expect(u.has("CSCI 1410")).toBe(false);
  });

  test("taking nothing unlocks nothing", () => {
    expect(unlockedCourses(g, new Set()).size).toBe(0);
  });

  test("and-groups require every group satisfied", () => {
    const u = unlockedCourses(g, new Set(["CSCI 0200", "MATH 0520"]));
    expect(u.has("CSCI 1410")).toBe(true);
  });

  test("progress counts CHOOSE_N as min(n, hits)/n", () => {
    expect(concentrationProgress(g, "conc:c:ScB", new Set())).toEqual({ satisfied: 0, required: 1 });
    expect(concentrationProgress(g, "conc:c:ScB", new Set(["CSCI 0150"]))).toEqual({ satisfied: 1, required: 1 });
    expect(
      concentrationProgress(g, "conc:c:ScB", new Set(["CSCI 0150", "CSCI 0170"]))
    ).toEqual({ satisfied: 1, required: 1 });
  });
});
