import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { ParsedConcentration, ReqNode } from "./types.js";

type Group = ReqNode & { kind: "group" };

const WORD_N: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
};

function normCode(raw: string): string {
  return raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/** Degree label from heading text, e.g. "Requirements for the Standard Track of the Sc.B. degree" */
function degreeFromHeading(text: string): string | null {
  const t = text.toLowerCase();
  const scb = /sc\.?\s?b\.?/.test(t);
  const ab = /a\.?b\.?\s?(degree|$)|\ba\.b\./.test(t);
  if (scb && !ab) return "ScB";
  if (ab && !scb) return "AB";
  if (scb && ab) return "ScB+AB";
  // Track-style headings ("Standard Economics Concentration", "Business Economics Track")
  if (/concentration|track|program requirements|requirements/i.test(text) && text.length < 90)
    return text.replace(/\s+/g, " ").trim();
  return null;
}

function chooseN(text: string): number | null {
  const m = text.match(/select\s+(one|two|three|four|five|six|seven|eight|\d+)/i);
  if (!m) return null;
  const w = m[1].toLowerCase();
  return WORD_N[w] ?? parseInt(w, 10);
}

export function parseConcentration(
  slug: string,
  name: string,
  html: string
): ParsedConcentration[] {
  const $ = cheerio.load(html);
  const results: ParsedConcentration[] = [];

  // Find each courselist table and the nearest preceding heading-ish text.
  const tables = $("table.sc_courselist").toArray();
  for (const [ti, tableEl] of tables.entries()) {
    // Walk backwards through previous siblings/ancestors for a degree heading.
    let degree = "unified";
    let cursor: AnyNode | null = tableEl;
    outer: for (let hops = 0; hops < 40 && cursor; hops++) {
      let prev = ($(cursor).prev() as cheerio.Cheerio<AnyNode>)[0] ?? null;
      if (!prev) {
        cursor = ($(cursor).parent() as cheerio.Cheerio<AnyNode>)[0] ?? null;
        continue;
      }
      cursor = prev;
      const txt = $(prev).text().replace(/\s+/g, " ").trim();
      if (!txt) continue;
      const tag = (prev as any).tagName?.toLowerCase?.() ?? "";
      const isHeadingish =
        /^h[1-6]$/.test(tag) ||
        (tag === "p" && $(prev).find("strong").length > 0 && txt.length < 120);
      if (isHeadingish) {
        const d = degreeFromHeading(txt);
        if (d) {
          degree = d;
          break outer;
        }
      }
    }
    if (tables.length === 1 && degree === "unified") degree = "unified";
    if (degree === "ScB+AB") degree = ti === 0 ? "ScB" : "AB"; // comp-style pairs

    const root: Group = { kind: "group", label: "root", type: "ALL", children: [] };
    const unparsed: string[] = [];
    // Stack entries: group + the indent level it was opened at + whether it's
    // a CHOOSE_N that should auto-close when its direct children stop.
    const stack: { g: Group; indent: number; fromComment: boolean }[] = [
      { g: root, indent: -1, fromComment: false },
    ];
    const top = () => stack[stack.length - 1];
    let pendingOr: ReqNode | null = null; // last leaf, for orclass handling

    const rows = $(tableEl).find("tr").toArray();
    for (const tr of rows) {
      const cls = $(tr).attr("class") ?? "";
      if (/listsum/.test(cls)) continue;
      const indent = $(tr).find('[style*="margin-left"]').length > 0 ? 1 : 0;
      const codeCell = $(tr).find("td.codecol");
      const isOr = /orclass/.test(cls) || codeCell.hasClass("codecol orclass");
      const commentSpan = $(tr).find("span.courselistcomment");
      const isAreaHeader = /areaheader/.test(cls);

      const flushLeaf = (leaf: ReqNode) => {
        if (isOr && pendingOr) {
          // Wrap previous leaf + this one in CHOOSE_N(1) unless already wrapped.
          const parent = top().g;
          const last = parent.children[parent.children.length - 1];
          if (
            last &&
            last.kind === "group" &&
            last.type === "CHOOSE_N" &&
            last.n === 1 &&
            last.label === "__or__"
          ) {
            last.children.push(leaf);
          } else {
            const idx = parent.children.lastIndexOf(pendingOr);
            const orGroup: Group = {
              kind: "group", label: "__or__", type: "CHOOSE_N", n: 1,
              children: [pendingOr, leaf],
            };
            if (idx >= 0) parent.children.splice(idx, 1, orGroup);
            else parent.children.push(orGroup);
            pendingOr = orGroup as unknown as ReqNode;
            return;
          }
          return;
        }
        top().g.children.push(leaf);
        pendingOr = leaf;
      };

      if (codeCell.length > 0) {
        const codes = codeCell
          .find("a.code")
          .toArray()
          .map((a) => normCode($(a).attr("data-code") ?? $(a).text()));
        const rawCode = normCode(codeCell.text());
        if (codes.length === 0) {
          unparsed.push(rawCode);
          continue;
        }
        // "/" in raw text between codes → cross-listing (same course); "&" → series
        const isSeries = /&/.test(rawCode);
        if (isSeries && codes.length > 1) {
          flushLeaf({ kind: "series", codes });
        } else if (codes.length > 1 && /\//.test(rawCode)) {
          // cross-listed: keep the first code as canonical; note others as series of one? no —
          // treat as OR of equivalent codes
          const orGroup: Group = {
            kind: "group", label: "__xlist__", type: "CHOOSE_N", n: 1,
            children: codes.map((c) => ({ kind: "course", code: c }) as ReqNode),
          };
          flushLeaf(orGroup);
        } else {
          flushLeaf({ kind: "course", code: codes[0] });
        }
        continue;
      }

      if (commentSpan.length > 0) {
        const text = commentSpan.text().replace(/\s+/g, " ").trim();
        if (!text || /^and$/i.test(text)) continue;
        const hours = $(tr).find("td.hourscol").text().trim();
        const n = chooseN(text) ?? (hours && /select/i.test(text) ? parseInt(hours, 10) : null);

        if (isAreaHeader) {
          // Close any groups opened at same-or-deeper indent, then open ALL group
          while (stack.length > 1 && top().indent >= indent) stack.pop();
          const g: Group = { kind: "group", label: text, type: "ALL", children: [] };
          // A series header (Series A/B/C) inside a CHOOSE group acts as SERIES option
          if (/^series\s+[a-z]$/i.test(text)) g.type = "SERIES";
          top().g.children.push(g);
          stack.push({ g, indent, fromComment: false });
          pendingOr = null;
        } else if (n !== null) {
          while (stack.length > 1 && top().indent > indent) stack.pop();
          const g: Group = { kind: "group", label: text, type: "CHOOSE_N", n, children: [] };
          top().g.children.push(g);
          stack.push({ g, indent, fromComment: true });
          pendingOr = null;
        } else {
          // Prose row: informational label ("Core Computer Science:") or unparseable text.
          if (/:$/.test(text) && text.length < 60) {
            while (stack.length > 1 && top().indent >= indent && top().fromComment === false)
              stack.pop();
            const g: Group = { kind: "group", label: text, type: "ALL", children: [] };
            top().g.children.push(g);
            stack.push({ g, indent, fromComment: false });
            pendingOr = null;
          } else {
            unparsed.push(text);
          }
        }
        continue;
      }
    }

    prune(root);
    results.push({ slug, name, degree, root, unparsed });
  }
  return results;
}

/** Remove empty groups recursively. */
function prune(g: Group): void {
  g.children = g.children.filter((c) => {
    if (c.kind === "group") {
      prune(c);
      return c.children.length > 0;
    }
    return true;
  });
}
