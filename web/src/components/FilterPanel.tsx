"use client";

import { useMemo, useState } from "react";
import type Graph from "graphology";

export interface Filters {
  depts: Set<string>;
  minLevel: number;
  maxLevel: number;
  hideIsolated: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  depts: new Set(),
  minLevel: 0,
  maxLevel: 2999,
  hideIsolated: true,
};

export function FilterPanel({
  graph,
  filters,
  setFilters,
  focused,
  onClearFocus,
}: {
  graph: Graph;
  filters: Filters;
  setFilters: (f: Filters) => void;
  focused: boolean;
  onClearFocus: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deptQuery, setDeptQuery] = useState("");

  const allDepts = useMemo(() => {
    const counts = new Map<string, number>();
    graph.forEachNode((_, a) => {
      if (a.kind === "course" && a.dept) counts.set(a.dept, (counts.get(a.dept) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  const shownDepts = useMemo(() => {
    const q = deptQuery.trim().toUpperCase();
    const list = q ? allDepts.filter(([d]) => d.includes(q)) : allDepts;
    return list.slice(0, 12);
  }, [allDepts, deptQuery]);

  const card: React.CSSProperties = {
    position: "absolute",
    top: 64,
    left: 12,
    width: 320,
    background: "rgba(17,22,34,.94)",
    border: "1px solid #2a3347",
    borderRadius: 12,
    color: "#d5dbe3",
    fontFamily: "system-ui",
    fontSize: 13,
    zIndex: 10,
  };

  return (
    <div style={card}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontWeight: 600 }}
      >
        <span>
          Filters
          {filters.depts.size > 0 ? ` · ${[...filters.depts].slice(0, 3).join(", ")}${filters.depts.size > 3 ? "…" : ""}` : ""}
        </span>
        <span>{open ? "▴" : "▾"}</span>
      </div>
      {focused && (
        <div style={{ padding: "0 14px 10px" }}>
          <button
            onClick={onClearFocus}
            style={{ width: "100%", padding: "7px 0", borderRadius: 8, border: "1px solid #3d4a63", background: "#1c2434", color: "#9fb4d8", cursor: "pointer" }}
          >
            ← Back to full map (focus active)
          </button>
        </div>
      )}
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#7b8494", margin: "4px 0 6px" }}>Departments</div>
          <input
            value={deptQuery}
            onChange={(e) => setDeptQuery(e.target.value)}
            placeholder="Find department…"
            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #2a3347", background: "#0e1420", color: "#d5dbe3", fontSize: 13 }}
          />
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {shownDepts.map(([d, c]) => {
              const active = filters.depts.has(d);
              return (
                <span
                  key={d}
                  onClick={() => {
                    const next = new Set(filters.depts);
                    active ? next.delete(d) : next.add(d);
                    setFilters({ ...filters, depts: next });
                  }}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: active ? "#2b5c9e" : "#1c2434",
                    color: active ? "#fff" : "#9aa4b2",
                  }}
                >
                  {d} <span style={{ opacity: 0.6 }}>{c}</span>
                </span>
              );
            })}
            {filters.depts.size > 0 && (
              <span
                onClick={() => setFilters({ ...filters, depts: new Set() })}
                style={{ padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: "#3b2020", color: "#d99" }}
              >
                clear
              </span>
            )}
          </div>

          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#7b8494", margin: "12px 0 6px" }}>Course level</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              ["All", 0, 2999],
              ["Intro (0xxx)", 0, 999],
              ["Upper (1xxx)", 1000, 1999],
              ["Grad (2xxx)", 2000, 2999],
            ].map(([label, lo, hi]) => {
              const active = filters.minLevel === lo && filters.maxLevel === hi;
              return (
                <span
                  key={label as string}
                  onClick={() => setFilters({ ...filters, minLevel: lo as number, maxLevel: hi as number })}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: active ? "#2b5c9e" : "#1c2434",
                    color: active ? "#fff" : "#9aa4b2",
                    fontSize: 12,
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={filters.hideIsolated}
              onChange={(e) => setFilters({ ...filters, hideIsolated: e.target.checked })}
            />
            Hide courses with no prerequisite links
          </label>
        </div>
      )}
    </div>
  );
}
