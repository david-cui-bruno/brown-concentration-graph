export type ReqNode =
  | {
      kind: "group";
      label: string;
      type: "ALL" | "CHOOSE_N" | "SERIES";
      n?: number;
      children: ReqNode[];
    }
  | { kind: "course"; code: string } // "CSCI 0150"
  | { kind: "series"; codes: string[] }; // CSCI 0150 & CSCI 0200

export interface ParsedConcentration {
  slug: string;
  name: string;
  degree: string; // "ScB" | "AB" | free-form track label | "unified"
  root: ReqNode & { kind: "group" };
  unparsed: string[]; // flagged prose rows
}

export interface PrereqEdge {
  from: string;
  to: string;
  group: number;
  kind: "hard" | "placement";
}
