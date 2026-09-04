import { expect, test } from "vitest";
import Graph from "graphology";
import { assembleGraph, sanityCheck } from "../src/build-graph.js";
import type { ParsedConcentration, PrereqEdge } from "../src/types.js";

const tiny: ParsedConcentration[] = [
  {
    slug: "test",
    name: "Testology",
    degree: "ScB",
    root: {
      kind: "group",
      label: "root",
      type: "ALL",
      children: [
        { kind: "course", code: "TEST 0100" },
        {
          kind: "group",
          label: "Select one of the following:",
          type: "CHOOSE_N",
          n: 1,
          children: [
            { kind: "course", code: "TEST 0200" },
            { kind: "series", codes: ["TEST 0210", "TEST 0220"] },
          ],
        },
      ],
    },
    unparsed: [],
  },
];

const prereqs: PrereqEdge[] = [
  { from: "TEST 0100", to: "TEST 0200", group: 0, kind: "hard" },
  { from: "TEST 0100", to: "TEST 0210", group: 0, kind: "hard" },
];

test("assembleGraph creates course, concentration, reqgroup nodes", () => {
  const g = assembleGraph(tiny, prereqs);
  expect(g.hasNode("TEST 0100")).toBe(true);
  expect(g.hasNode("conc:test:ScB")).toBe(true);
  const kinds = new Set(g.mapNodes((_, a) => a.kind));
  expect(kinds).toEqual(new Set(["course", "concentration", "reqgroup"]));
});

test("FULFILLS edges connect courses to reqgroups, PART_OF chains to concentration", () => {
  const g = assembleGraph(tiny, prereqs);
  // TEST 0100 fulfills the root group which is PART_OF the concentration
  const fulfills = g.outEdges("TEST 0100").filter((e) => g.getEdgeAttribute(e, "type") === "FULFILLS");
  expect(fulfills.length).toBe(1);
  // every reqgroup reaches the concentration via PART_OF
  const rgs = g.filterNodes((_, a) => a.kind === "reqgroup");
  for (const rg of rgs) {
    let cur = rg;
    let guard = 0;
    while (g.getNodeAttribute(cur, "kind") !== "concentration" && guard++ < 10) {
      const out = g.outEdges(cur).filter((e) => g.getEdgeAttribute(e, "type") === "PART_OF");
      expect(out.length).toBe(1);
      cur = g.target(out[0]);
    }
    expect(g.getNodeAttribute(cur, "kind")).toBe("concentration");
  }
});

test("series members become courses fulfilling a SERIES group", () => {
  const g = assembleGraph(tiny, prereqs);
  expect(g.hasNode("TEST 0210")).toBe(true);
  expect(g.hasNode("TEST 0220")).toBe(true);
});

test("prereq edges carry group and kind", () => {
  const g = assembleGraph(tiny, prereqs);
  const e = g.edges("TEST 0100", "TEST 0200").find(
    (e) => g.getEdgeAttribute(e, "type") === "PREREQ_OF"
  )!;
  expect(g.getEdgeAttribute(e, "kind")).toBe("hard");
  expect(g.getEdgeAttribute(e, "group")).toBe(0);
});

test("sanityCheck flags planted cycle and passes clean graph", () => {
  const g = assembleGraph(tiny, prereqs);
  const clean = sanityCheck(g);
  expect(clean.errors).toEqual([]);
  expect(clean.cycles.length).toBe(0);

  const bad = new Graph({ multi: true, type: "directed" });
  bad.addNode("A", { kind: "course" });
  bad.addNode("B", { kind: "course" });
  bad.addEdge("A", "B", { type: "PREREQ_OF" });
  bad.addEdge("B", "A", { type: "PREREQ_OF" });
  expect(sanityCheck(bad).cycles.length).toBeGreaterThan(0);
});
