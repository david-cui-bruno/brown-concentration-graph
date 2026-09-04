import type { ExportNode } from "./graph";

/** Numeric course level from a code like "CSCI 0150" -> 150, "MATH 1530" -> 1530. */
export function courseLevel(code: string): number {
  const m = code.match(/(\d{3,4})/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Height (y) encodes academic depth:
 *   0xxx intro courses:   0..40
 *   1xxx upper courses:  40..80
 *   2xxx+ grad courses:  80..100
 *   requirement groups:  112 (only shown in focus mode)
 *   concentrations:      130 (a "gold ceiling" above the courses that feed them)
 */
export function heightFor(node: Pick<ExportNode, "id" | "kind">): number {
  if (node.kind === "concentration") return 235;
  if (node.kind === "reqgroup") return 205;
  const n = courseLevel(node.id);
  if (n < 1000) return (n / 1000) * 70;
  if (n < 2000) return 70 + ((n - 1000) / 1000) * 70;
  return 140 + Math.min(((n - 2000) / 1000) * 40, 40);
}

/** Scale factor mapping the exported 2D layout onto a disc of the given radius. */
export function planarScale(nodes: Pick<ExportNode, "x" | "y">[], radius = 480): number {
  let max = 1;
  for (const n of nodes) max = Math.max(max, Math.abs(n.x), Math.abs(n.y));
  return radius / max;
}

export const BAND_LABELS: { y: number; label: string }[] = [
  { y: 0, label: "0xxx · intro" },
  { y: 70, label: "1xxx · upper level" },
  { y: 140, label: "2xxx · graduate" },
];
