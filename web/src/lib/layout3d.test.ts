import { describe, expect, test } from "vitest";
import { courseLevel, heightFor, planarScale } from "./layout3d";

describe("layout3d", () => {
  test("courseLevel parses padded and long codes", () => {
    expect(courseLevel("CSCI 0150")).toBe(150);
    expect(courseLevel("MATH 1530")).toBe(1530);
    expect(courseLevel("CSCI 1951A")).toBe(1951);
    expect(courseLevel("BIOL 2010")).toBe(2010);
  });

  test("height is monotonic in level and banded", () => {
    const h = (code: string) => heightFor({ id: code, kind: "course" });
    expect(h("CSCI 0150")).toBeLessThan(h("CSCI 0300"));
    expect(h("CSCI 0300")).toBeLessThan(h("CSCI 1010"));
    expect(h("CSCI 1010")).toBeLessThan(h("CSCI 1970"));
    expect(h("CSCI 1970")).toBeLessThan(h("CSCI 2500"));
    expect(h("CSCI 0999")).toBeLessThanOrEqual(70);
    expect(h("CSCI 1000")).toBeGreaterThanOrEqual(70);
  });

  test("concentrations sit above every course and reqgroups below them", () => {
    const conc = heightFor({ id: "conc:x:ScB", kind: "concentration" });
    const rg = heightFor({ id: "rg:x", kind: "reqgroup" });
    const grad = heightFor({ id: "BIOL 2980", kind: "course" });
    expect(conc).toBeGreaterThan(rg);
    expect(rg).toBeGreaterThan(grad);
  });

  test("planarScale fits layout into radius", () => {
    const s = planarScale([{ x: 1000, y: -500 }, { x: -200, y: 100 }], 340);
    expect(1000 * s).toBeCloseTo(340);
  });
});
