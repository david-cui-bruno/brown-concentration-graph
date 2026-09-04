import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { extractPrereqText, stripHtml } from "../src/cab.js";

test("stripHtml removes tags and entities", () => {
  expect(stripHtml("<p><a href='x'>CSCI&nbsp;0150</a> or <b>0170</b></p>")).toBe(
    "CSCI 0150 or 0170"
  );
});

test("extractPrereqText pulls prerequisite sentence from captured CAB details", () => {
  const d = JSON.parse(readFileSync("test/fixtures/cab-details-csci0200.json", "utf8"));
  const text = extractPrereqText(d.registration_restrictions);
  expect(text).toMatch(/^Prerequisites?:/);
  expect(text).toContain("CSCI 0112");
  expect(text).toContain("0190");
});

test("extractPrereqText returns null when no prereq section", () => {
  expect(extractPrereqText("<p>Enrollment limited to 20.</p>")).toBeNull();
  expect(extractPrereqText(null)).toBeNull();
  expect(extractPrereqText("")).toBeNull();
});
