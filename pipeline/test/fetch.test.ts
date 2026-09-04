import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { cachePath, parseIndex } from "../src/fetch.js";

test("cachePath is deterministic", () => {
  expect(cachePath("https://x.com/a")).toBe(cachePath("https://x.com/a"));
  expect(cachePath("https://x.com/a")).not.toBe(cachePath("https://x.com/b"));
});

test("parseIndex extracts concentration links", () => {
  const html = readFileSync("test/fixtures/index.html", "utf8");
  const rows = parseIndex(html);
  expect(rows.length).toBeGreaterThan(80);
  expect(rows.find((r) => r.slug === "comp")).toMatchObject({
    name: "Computer Science",
  });
});
