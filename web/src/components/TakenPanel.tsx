"use client";

import { useMemo, useState } from "react";
import type Graph from "graphology";
import { unlockedCourses } from "@/lib/unlock";

export function TakenPanel({
  graph,
  taken,
  setTaken,
}: {
  graph: Graph;
  taken: Set<string>;
  setTaken: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const courseIds = useMemo(() => {
    const ids: string[] = [];
    graph.forEachNode((id, a) => {
      if (a.kind === "course") ids.push(id);
    });
    return ids.sort();
  }, [graph]);

  const matches = useMemo(() => {
    const needle = q.trim().toUpperCase();
    if (needle.length < 2) return [];
    return courseIds.filter((c) => c.includes(needle) && !taken.has(c)).slice(0, 8);
  }, [q, courseIds, taken]);

  const unlocked = useMemo(
    () => (taken.size ? [...unlockedCourses(graph, taken)].sort().slice(0, 40) : []),
    [graph, taken]
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 32,
        left: 12,
        width: 320,
        background: "white",
        borderRadius: 12,
        border: "1px solid #e3e6ea",
        boxShadow: "0 6px 24px rgba(0,0,0,.12)",
        fontFamily: "system-ui",
        fontSize: 13,
        zIndex: 10,
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontWeight: 600 }}
      >
        <span>
          My courses{taken.size ? ` (${taken.size})` : ""}
          {unlocked.length ? ` · ${unlocked.length} unlocked` : ""}
        </span>
        <span>{open ? "▾" : "▴"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a course, e.g. CSCI 0150"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d0d4da", fontSize: 13 }}
          />
          {matches.map((m) => (
            <div
              key={m}
              onClick={() => {
                setTaken(new Set([...taken, m]));
                setQ("");
              }}
              style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 6 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f2f4f7")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              + {m}
            </div>
          ))}
          {taken.size > 0 && (
            <div style={{ marginTop: 10 }}>
              {[...taken].sort().map((c) => (
                <span
                  key={c}
                  onClick={() => {
                    const next = new Set(taken);
                    next.delete(c);
                    setTaken(next);
                  }}
                  title="Click to remove"
                  style={{
                    display: "inline-block",
                    margin: "2px 4px 2px 0",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "#e5f5e9",
                    color: "#1a7a3d",
                    cursor: "pointer",
                  }}
                >
                  {c} ✕
                </span>
              ))}
            </div>
          )}
          {unlocked.length > 0 && (
            <>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#8a8f98", margin: "10px 0 4px" }}>
                Unlocked next
              </div>
              <div>
                {unlocked.map((c) => (
                  <span
                    key={c}
                    style={{
                      display: "inline-block",
                      margin: "2px 4px 2px 0",
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "#fdf3e3",
                      color: "#a3690b",
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
