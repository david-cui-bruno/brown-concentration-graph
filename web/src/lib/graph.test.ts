import { describe, expect, test } from "vitest";
import { loadGraph, prereqClosure, concentrationSubtree, concentrationsOf } from "./graph";
import type { GraphExport } from "./graph";

const fixture: GraphExport = {
  nodes: [
    { id: "A 0100", label: "A 0100", kind: "course", x: 0, y: 0, size: 2, color: "#000" },
    { id: "A 0200", label: "A 0200", kind: "course", x: 1, y: 0, size: 2, color: "#000" },
    { id: "A 0300", label: "A 0300", kind: "course", x: 2, y: 0, size: 2, color: "#000" },
    { id: "rg:x:AB:0", label: "core", kind: "reqgroup", x: 3, y: 0, size: 1, color: "#999" },
    { id: "conc:x:AB", label: "X (AB)", kind: "concentration", x: 4, y: 0, size: 9, color: "#eb0" },
  ],
  edges: [
    { source: "A 0100", target: "A 0200", type: "PREREQ_OF" },
    { source: "A 0200", target: "A 0300", type: "PREREQ_OF" },
    { source: "A 0300", target: "rg:x:AB:0", type: "FULFILLS" },
    { source: "rg:x:AB:0", target: "conc:x:AB", type: "PART_OF" },
  ],
  meta: { generatedAt: "", counts: {} },
};

describe("graph lib", () => {
  const g = loadGraph(fixture);

  test("prereqClosure up collects transitive prereqs", () => {
    expect(prereqClosure(g, "A 0300", "up")).toEqual(new Set(["A 0200", "A 0100"]));
  });

  test("prereqClosure down collects unlocked courses", () => {
    expect(prereqClosure(g, "A 0100", "down")).toEqual(new Set(["A 0200", "A 0300"]));
  });

  test("concentrationSubtree collects groups and courses", () => {
    expect(concentrationSubtree(g, "conc:x:AB")).toEqual(new Set(["rg:x:AB:0", "A 0300"]));
  });

  test("concentrationsOf walks FULFILLS/PART_OF to concentrations", () => {
    expect(concentrationsOf(g, "A 0300")).toEqual(new Set(["conc:x:AB"]));
    expect(concentrationsOf(g, "A 0100")).toEqual(new Set());
  });
});
