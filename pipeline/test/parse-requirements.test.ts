import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseConcentration } from "../src/parse-requirements.js";

const load = (s: string) => readFileSync(`test/fixtures/${s}.html`, "utf8");

test("comp yields ScB and AB tables", () => {
  const tables = parseConcentration("comp", "Computer Science", load("comp"));
  expect(tables.length).toBeGreaterThanOrEqual(2);
  const degrees = tables.map((t) => t.degree);
  expect(degrees).toContain("ScB");
  expect(degrees).toContain("AB");
});

test("comp ScB has intro series inside a CHOOSE group", () => {
  const scb = parseConcentration("comp", "Computer Science", load("comp")).find(
    (t) => t.degree === "ScB"
  )!;
  const json = JSON.stringify(scb.root);
  expect(json).toContain('"CSCI 0150"');
  expect(json).toContain('"CHOOSE_N"');
  expect(json).toContain('"kind":"series"');
});

test("or-alternatives group MATH 0100/0170 as siblings in CHOOSE_N(1)", () => {
  const scb = parseConcentration("comp", "Computer Science", load("comp")).find(
    (t) => t.degree === "ScB"
  )!;
  let found = false;
  const walk = (n: any) => {
    if (n.kind === "group") {
      if (
        n.type === "CHOOSE_N" &&
        n.n === 1 &&
        JSON.stringify(n.children).includes("MATH 0100") &&
        JSON.stringify(n.children).includes("MATH 0170")
      )
        found = true;
      n.children.forEach(walk);
    }
  };
  walk(scb.root);
  expect(found).toBe(true);
});

test("econ produces multiple track tables", () => {
  const tables = parseConcentration("econ", "Economics", load("econ"));
  expect(tables.length).toBeGreaterThanOrEqual(3);
  expect(JSON.stringify(tables.map((t) => t.root))).toContain("ECON 0110");
});

test("prose-heavy pages flag unparsed rows instead of throwing", () => {
  const tables = parseConcentration("musc", "Music", load("musc"));
  expect(tables.length).toBeGreaterThan(0);
  expect(tables.every((t) => Array.isArray(t.unparsed))).toBe(true);
});

test("all courses use normalized DEPT NNNN codes", () => {
  const tables = parseConcentration("hhbi", "Health & Human Biology", load("hhbi"));
  const codes: string[] = [];
  const walk = (n: any) => {
    if (n.kind === "course") codes.push(n.code);
    if (n.kind === "series") codes.push(...n.codes);
    if (n.kind === "group") n.children.forEach(walk);
  };
  tables.forEach((t) => walk(t.root));
  expect(codes.length).toBeGreaterThan(10);
  for (const c of codes) expect(c).toMatch(/^[A-Z]{2,4} \d{4}[A-Z]?$/);
});
