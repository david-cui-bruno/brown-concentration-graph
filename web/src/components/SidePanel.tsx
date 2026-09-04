"use client";

import type Graph from "graphology";
import { concentrationsOf, prereqClosure } from "@/lib/graph";
import { concentrationProgress } from "@/lib/unlock";

export function SidePanel({
  graph,
  nodeId,
  taken,
  onClose,
  onNavigate,
}: {
  graph: Graph;
  nodeId: string;
  taken: Set<string>;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const a = graph.getNodeAttributes(nodeId);
  const isCourse = a.kind === "course";

  const directPrereqs = isCourse
    ? graph
        .inEdges(nodeId)
        .filter((e) => graph.getEdgeAttribute(e, "type") === "PREREQ_OF")
        .map((e) => graph.source(e))
    : [];
  const unlocks = isCourse ? [...prereqClosure(graph, nodeId, "down")].slice(0, 30) : [];
  const concs = isCourse ? [...concentrationsOf(graph, nodeId)] : [];
  const progress =
    a.kind === "concentration" && taken.size > 0
      ? concentrationProgress(graph, nodeId, taken)
      : null;

  const chip = (id: string) => (
    <span
      key={id}
      onClick={() => onNavigate(id)}
      style={{
        display: "inline-block",
        margin: "2px 4px 2px 0",
        padding: "3px 8px",
        borderRadius: 6,
        background: taken.has(id) ? "#e5f5e9" : "#eef1f5",
        color: taken.has(id) ? "#1a7a3d" : "#333",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {graph.hasNode(id) ? graph.getNodeAttribute(id, "label") : id}
    </span>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 340,
        maxHeight: "calc(100vh - 24px)",
        overflowY: "auto",
        background: "white",
        borderRadius: 12,
        border: "1px solid #e3e6ea",
        boxShadow: "0 6px 24px rgba(0,0,0,.12)",
        padding: 16,
        fontFamily: "system-ui",
        fontSize: 13,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{a.label}</h2>
        <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 16, cursor: "pointer", color: "#888" }}>
          ✕
        </button>
      </div>

      {isCourse && (
        <>
          <div style={{ color: "#777", marginTop: 4 }}>{a.dept}</div>
          <h3 style={h3}>Official prerequisite text</h3>
          <div style={{ color: a.prereqText ? "#333" : "#999", fontStyle: a.prereqText ? "normal" : "italic" }}>
            {a.prereqText ?? "None listed."}
          </div>
          {directPrereqs.length > 0 && (
            <>
              <h3 style={h3}>Direct prerequisites</h3>
              <div>{[...new Set(directPrereqs)].map(chip)}</div>
            </>
          )}
          {unlocks.length > 0 && (
            <>
              <h3 style={h3}>Leads to ({unlocks.length}{unlocks.length === 30 ? "+" : ""})</h3>
              <div>{unlocks.map(chip)}</div>
            </>
          )}
          <h3 style={h3}>Counts toward</h3>
          <div>
            {concs.length ? concs.map(chip) : <span style={{ color: "#999", fontStyle: "italic" }}>No concentration requirement found.</span>}
          </div>
        </>
      )}

      {a.kind === "concentration" && (
        <>
          <div style={{ color: "#777", marginTop: 4 }}>Requirement subtree isolated on the map.</div>
          {progress && (
            <>
              <h3 style={h3}>Your progress</h3>
              <div>
                {progress.satisfied} / {progress.required} requirements satisfiable with your courses
              </div>
              <div style={{ background: "#eef1f5", borderRadius: 6, height: 8, marginTop: 6 }}>
                <div
                  style={{
                    width: `${Math.min(100, (100 * progress.satisfied) / Math.max(1, progress.required))}%`,
                    background: "#1a9850",
                    height: 8,
                    borderRadius: 6,
                  }}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const h3: React.CSSProperties = { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#8a8f98", margin: "14px 0 6px" };
