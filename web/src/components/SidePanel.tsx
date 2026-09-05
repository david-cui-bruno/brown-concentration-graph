"use client";

import type Graph from "graphology";
import { useSession, signIn } from "next-auth/react";
import { concentrationsOf, prereqClosure } from "@/lib/graph";
import { concentrationProgress } from "@/lib/unlock";
import type { PlanState } from "@/lib/usePlan";

export function SidePanel({
  graph,
  nodeId,
  plan,
  onClose,
  onNavigate,
}: {
  graph: Graph;
  nodeId: string;
  plan: PlanState;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const { data: session } = useSession();
  const a = graph.getNodeAttributes(nodeId);
  const isCourse = a.kind === "course";
  const { taken, planned, setStatus, remove } = plan;

  const directPrereqs = isCourse
    ? graph
        .inEdges(nodeId)
        .filter((e) => graph.getEdgeAttribute(e, "etype") === "PREREQ_OF")
        .map((e) => graph.source(e))
    : [];
  const unlocks = isCourse ? [...prereqClosure(graph, nodeId, "down")].slice(0, 30) : [];
  const concs = isCourse ? [...concentrationsOf(graph, nodeId)] : [];
  const progress =
    a.kind === "concentration" && taken.size + planned.size > 0
      ? {
          taken: concentrationProgress(graph, nodeId, taken),
          withPlanned: concentrationProgress(graph, nodeId, new Set([...taken, ...planned])),
        }
      : null;

  const seatsCap = a.seatsCap as number | null;
  const seatsAvail = a.seatsAvail as number | null;
  const fillPct =
    seatsCap && seatsAvail !== null ? Math.round((100 * (seatsCap - seatsAvail)) / seatsCap) : null;

  const isTaken = taken.has(nodeId);
  const isPlanned = planned.has(nodeId);

  const btn = (label: string, active: boolean, activeColor: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 0",
        borderRadius: 8,
        border: `1px solid ${active ? activeColor : "#2b2d52"}`,
        background: active ? activeColor + "26" : "#1a1c3a",
        color: active ? activeColor : "#9aa4b2",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );

  const chip = (id: string) => (
    <span
      key={id}
      onClick={() => onNavigate(id)}
      style={{
        display: "inline-block",
        margin: "2px 4px 2px 0",
        padding: "3px 8px",
        borderRadius: 6,
        background: taken.has(id) ? "#173527" : planned.has(id) ? "#33301a" : "#1a1c3a",
        color: taken.has(id) ? "#8fd6a8" : planned.has(id) ? "#e8cf7a" : "#c3cad4",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {graph.hasNode(id) ? graph.getNodeAttribute(id, "label") : id}
    </span>
  );

  return (
    <div
      className="panel-side"
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 350,
        maxHeight: "calc(100vh - 24px)",
        overflowY: "auto",
        background: "rgba(13,14,32,.95)",
        borderRadius: 12,
        border: "1px solid #2b2d52",
        boxShadow: "0 6px 24px rgba(0,0,0,.3)",
        padding: 16,
        fontFamily: "system-ui",
        fontSize: 13,
        color: "#d5dbe3",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{a.label}</h2>
        <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 16, cursor: "pointer", color: "#8a93a3" }}>
          ✕
        </button>
      </div>

      {isCourse && (
        <>
          {a.title && <div style={{ color: "#aeb6c2", marginTop: 2 }}>{a.title}</div>}

          <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
            {btn(isTaken ? "✓ Taken" : "Mark taken", isTaken, "#8fd6a8", () =>
              isTaken ? remove(nodeId) : setStatus(nodeId, "taken")
            )}
            {btn(isPlanned ? "★ Planned" : "Add to plan", isPlanned, "#e8cf7a", () =>
              isPlanned ? remove(nodeId) : setStatus(nodeId, "planned")
            )}
          </div>
          {!session && (
            <div style={{ fontSize: 11, color: "#7b8494", marginTop: -6, marginBottom: 8 }}>
              Saved locally.{" "}
              <span onClick={() => signIn("google")} style={{ color: "#8fb4e8", cursor: "pointer", textDecoration: "underline" }}>
                Sign in with Brown Google
              </span>{" "}
              to sync.
            </div>
          )}

          {fillPct !== null && (
            <div style={{ margin: "6px 0 2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7b8494" }}>
                <span>Seat demand (latest term)</span>
                <span>
                  {seatsCap! - seatsAvail!}/{seatsCap} filled
                </span>
              </div>
              <div style={{ background: "#1a1c3a", borderRadius: 6, height: 7, marginTop: 4 }}>
                <div
                  style={{
                    width: `${fillPct}%`,
                    background: fillPct > 85 ? "#e08a8a" : fillPct > 60 ? "#e8cf7a" : "#8fd6a8",
                    height: 7,
                    borderRadius: 6,
                  }}
                />
              </div>
            </div>
          )}

          {a.description && (
            <>
              <h3 style={h3}>Description</h3>
              <div style={{ color: "#b9c1cc", lineHeight: 1.45 }}>{a.description}</div>
            </>
          )}

          <h3 style={h3}>Official prerequisite text</h3>
          <div style={{ color: a.prereqText ? "#b9c1cc" : "#6b7482", fontStyle: a.prereqText ? "normal" : "italic" }}>
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
            {concs.length ? concs.map(chip) : <span style={{ color: "#6b7482", fontStyle: "italic" }}>No concentration requirement found.</span>}
          </div>
        </>
      )}

      {a.kind === "concentration" && (
        <>
          <div style={{ color: "#8a93a3", marginTop: 4 }}>Requirement subtree isolated on the map.</div>
          {progress && (
            <>
              <h3 style={h3}>Your progress</h3>
              <div style={{ fontSize: 12, color: "#b9c1cc" }}>
                {progress.taken.satisfied} / {progress.taken.required} from taken courses
                {progress.withPlanned.satisfied > progress.taken.satisfied &&
                  ` (+${progress.withPlanned.satisfied - progress.taken.satisfied} with planned)`}
              </div>
              <div style={{ background: "#1a1c3a", borderRadius: 6, height: 8, marginTop: 6, position: "relative" }}>
                <div
                  style={{
                    width: `${Math.min(100, (100 * progress.withPlanned.satisfied) / Math.max(1, progress.withPlanned.required))}%`,
                    background: "#5a5432",
                    height: 8,
                    borderRadius: 6,
                    position: "absolute",
                  }}
                />
                <div
                  style={{
                    width: `${Math.min(100, (100 * progress.taken.satisfied) / Math.max(1, progress.taken.required))}%`,
                    background: "#8fd6a8",
                    height: 8,
                    borderRadius: 6,
                    position: "absolute",
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

const h3: React.CSSProperties = { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#7b8494", margin: "14px 0 6px" };
