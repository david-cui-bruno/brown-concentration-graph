import { expect, test } from "vitest";
import { parsePrereqText } from "../src/parse-prereqs.js";

test("simple or-group", () => {
  const { edges, unparsed } = parsePrereqText(
    "CSCI 0200",
    "Prerequisites: CSCI 0112, 0150, 0170 or 0190."
  );
  expect(edges).toEqual([
    { from: "CSCI 0112", to: "CSCI 0200", group: 0, kind: "hard" },
    { from: "CSCI 0150", to: "CSCI 0200", group: 0, kind: "hard" },
    { from: "CSCI 0170", to: "CSCI 0200", group: 0, kind: "hard" },
    { from: "CSCI 0190", to: "CSCI 0200", group: 0, kind: "hard" },
  ]);
  expect(unparsed).toBeNull();
});

test("and of parenthesized or-groups gets distinct group numbers", () => {
  const { edges } = parsePrereqText(
    "CSCI 1410",
    "Prerequisites: CSCI 0200 and (MATH 0520 or MATH 0540)."
  );
  const g = (code: string) => edges.find((e) => e.from === code)!.group;
  expect(edges).toHaveLength(3);
  expect(g("CSCI 0200")).not.toBe(g("MATH 0520"));
  expect(g("MATH 0520")).toBe(g("MATH 0540"));
});

test("bare numbers inherit the preceding department", () => {
  const { edges } = parsePrereqText(
    "MATH 0180",
    "Prerequisite: MATH 0100, 0170, or 0190."
  );
  expect(edges.map((e) => e.from)).toEqual(["MATH 0100", "MATH 0170", "MATH 0190"]);
  expect(new Set(edges.map((e) => e.group)).size).toBe(1);
});

test("placement language marks kind=placement but keeps course edges", () => {
  const { edges } = parsePrereqText(
    "ECON 1110",
    "Prerequisite: ECON 0110 or equivalent placement."
  );
  expect(edges).toHaveLength(1);
  expect(edges[0]).toMatchObject({ from: "ECON 0110", kind: "placement" });
});

test("AP/IB scores are ignored but courses still extracted; text flagged", () => {
  const { edges, unparsed } = parsePrereqText(
    "ECON 1110",
    "Prerequisites: (ECON 0110 or (minimum score of 4 in 'AP Microeconomics')) and (MATH 0060, 0070, 0090 or 0100)."
  );
  expect(edges.map((e) => e.from)).toContain("ECON 0110");
  expect(edges.map((e) => e.from)).toContain("MATH 0060");
  const econGroup = edges.find((e) => e.from === "ECON 0110")!.group;
  const mathGroup = edges.find((e) => e.from === "MATH 0060")!.group;
  expect(econGroup).not.toBe(mathGroup);
  expect(unparsed).not.toBeNull(); // AP alternative can't be modeled as a course edge
});

test("pure prose yields zero edges and flagged text", () => {
  const { edges, unparsed } = parsePrereqText("APMA 1650", "Instructor permission required.");
  expect(edges).toHaveLength(0);
  expect(unparsed).toBe("Instructor permission required.");
});

test("no self-edges", () => {
  const { edges } = parsePrereqText("MUSC 0550", "Prerequisite: MUSC 0550 placement exam or MUSC 0400.");
  expect(edges.every((e) => e.from !== "MUSC 0550")).toBe(true);
});
