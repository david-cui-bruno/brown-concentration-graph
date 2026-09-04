"use client";

import { useMemo, useState } from "react";
import type Graph from "graphology";

const box: React.CSSProperties = {
  position: "absolute",
  top: 12,
  left: 12,
  width: 320,
  fontFamily: "system-ui",
  zIndex: 10,
};

export function SearchBox({
  graph,
  onSelect,
}: {
  graph: Graph;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const index = useMemo(() => {
    const items: { id: string; text: string; kind: string }[] = [];
    graph.forEachNode((id, a) => {
      if (a.kind === "reqgroup") return;
      items.push({ id, text: `${a.label}`.toLowerCase(), kind: a.kind });
    });
    return items;
  }, [graph]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const score = (i: { id: string; text: string; kind: string }) => {
      const idL = i.id.toLowerCase();
      if (i.text === needle || idL === needle) return 0;
      if (i.text.startsWith(needle) || idL.startsWith(needle)) return 1;
      return 2;
    };
    return index
      .filter((i) => i.text.includes(needle) || i.id.toLowerCase().includes(needle))
      .sort((a, b) => score(a) - score(b) || a.text.length - b.text.length || a.id.localeCompare(b.id))
      .slice(0, 12);
  }, [q, index]);

  return (
    <div style={box}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search courses or concentrations…"
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #d0d4da",
          fontSize: 14,
          boxShadow: "0 2px 10px rgba(0,0,0,.08)",
          outline: "none",
          background: "white",
        }}
      />
      {results.length > 0 && (
        <div
          style={{
            marginTop: 6,
            background: "white",
            borderRadius: 10,
            border: "1px solid #e3e6ea",
            boxShadow: "0 6px 20px rgba(0,0,0,.10)",
            overflow: "hidden",
          }}
        >
          {results.map((r) => (
            <div
              key={r.id}
              onClick={() => {
                onSelect(r.id);
                setQ("");
              }}
              style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", display: "flex", gap: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f2f4f7")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              <span style={{ color: r.kind === "concentration" ? "#b8860b" : "#4867d6", fontSize: 11, minWidth: 82 }}>
                {r.kind === "concentration" ? "concentration" : "course"}
              </span>
              {graph.getNodeAttribute(r.id, "label")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
