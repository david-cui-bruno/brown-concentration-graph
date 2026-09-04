import type { PrereqEdge } from "./types.js";

/**
 * Parse official prerequisite text into edges.
 *
 * Model: top-level "and" separates requirement groups; within a group,
 * "or"/"," list alternatives. Each alternative course becomes an edge sharing
 * the group number. Content we cannot model (AP scores, permission language)
 * flags the text as `unparsed` while still emitting confident edges.
 */
export function parsePrereqText(
  toCode: string,
  text: string
): { edges: PrereqEdge[]; unparsed: string | null } {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const kind: PrereqEdge["kind"] = /place(ment)?\s?(out|exam)?|equivalent/i.test(cleaned)
    ? "placement"
    : "hard";

  // Strip leading "Prerequisite(s):" label.
  let body = cleaned.replace(/^prerequisites?\s*:?\s*/i, "");
  // Remove quoted exam names ('AP Calculus AB') so they don't look like codes.
  const hadExam = /minimum score|advanced placement|\bAP\b|\bIB\b/i.test(body);
  body = body.replace(/'[^']*'/g, " EXAM ");

  // Split into top-level AND segments, respecting parentheses.
  const segments: string[] = [];
  let depth = 0;
  let cur = "";
  const pushCur = () => {
    if (cur.trim()) segments.push(cur.trim());
    cur = "";
  };
  const tokens = body.split(/(\(|\)|\band\b|;)/i);
  for (const t of tokens) {
    if (t === "(") depth++;
    else if (t === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && (/^and$/i.test(t) || t === ";")) {
      pushCur();
      continue;
    }
    cur += t;
  }
  pushCur();

  const edges: PrereqEdge[] = [];
  const seen = new Set<string>();
  let group = 0;
  let anyCourseInSegment = false;
  const codeRe = /([A-Z]{2,4})\s?(\d{4}[A-Z]?)|(?<![A-Z\d])(\d{4}[A-Z]?)(?![\d])/g;

  for (const seg of segments) {
    let dept: string | null = null;
    let matched = false;
    for (const m of seg.matchAll(codeRe)) {
      let code: string | null = null;
      if (m[1]) {
        dept = m[1];
        code = `${m[1]} ${m[2]}`;
      } else if (m[3] && dept) {
        code = `${dept} ${m[3]}`;
      }
      if (!code || code === toCode) continue;
      if (seen.has(code)) continue;
      seen.add(code);
      edges.push({ from: code, to: toCode, group, kind });
      matched = true;
    }
    if (matched) {
      group++;
      anyCourseInSegment = true;
    }
  }

  // Flag anything we couldn't fully model.
  const STOPWORDS =
    /prerequisites?|or|and|the|of|in|a|an|to|is|are|equivalent|placement|concurrent(ly)?|enrollment|registration|course|courses|minimum|score|exam|EXAM|instructor|permission|required?|recommended|with|grade|at|least|completion|prior|may|be|taken|s/gi;
  const leftovers = body
    .replace(codeRe, " ")
    .replace(/[(),.;:'&\-\/]/g, " ")
    .replace(STOPWORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
  const unparsed =
    edges.length === 0 || leftovers.length > 3 || hadExam ? cleaned : null;

  return { edges, unparsed: unparsed as string | null };
}
