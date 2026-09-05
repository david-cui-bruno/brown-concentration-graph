"use client";

import { useMemo, useState } from "react";
import type Graph from "graphology";
import { unlockedCourses } from "@/lib/unlock";
import type { PlanState } from "@/lib/usePlan";

export function TakenPanel({ graph, plan }: { graph: Graph; plan: PlanState }) {
  const { taken, setStatus, remove } = plan;
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
      className="panel-taken"
      style={{
        position: "absolute",
        bottom: 32,
        left: 12,
        width: 320,
        background: "rgba(13,14,32,.92)",
        borderRadius: 12,
        border: "1px solid #2b2d52",
        boxShadow: "0 6px 24px rgba(0,0,0,.12)",
        fontFamily: "system-ui",
        fontSize: 13,
        color: "#d5dbe3",
        zIndex: 10,
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontWeight: 600 }}
      >
        <span>
          My star chart{taken.size ? ` (${taken.size})` : ""}
          {unlocked.length ? ` · ${unlocked.length} unlocked` : ""}
        </span>
        <span>{open ? "▾" : "▴"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a star, e.g. CSCI 0150"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #2b2d52", background: "#0c0e22", color: "#d5dbe3", fontSize: 13 }}
          />
          {matches.map((m) => (
            <div
              key={m}
              onClick={() => {
                setStatus(m, "taken");
                setQ("");
              }}
              style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 6 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1c3a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              + {m}
            </div>
          ))}
          {taken.size > 0 && (
            <div style={{ marginTop: 10 }}>
              {[...taken].sort().map((c) => (
                <span
                  key={c}
                  onClick={() => remove(c)}
                  title="Click to remove"
                  style={{
                    display: "inline-block",
                    margin: "2px 4px 2px 0",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "#173527",
                    color: "#5fd08a",
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
                Within reach
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
                      background: "#3a2d12",
                      color: "#e8b45a",
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
