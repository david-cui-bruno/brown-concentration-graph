"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import type Graph from "graphology";
import { loadGraph, type GraphExport } from "@/lib/graph";
import { concentrationProgress, unlockedCourses } from "@/lib/unlock";
import { usePlan } from "@/lib/usePlan";
import { AuthBar } from "./AuthBar";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const plan = usePlan();
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    fetch("/graph.json")
      .then((r) => r.json())
      .then((d: GraphExport) => setGraph(loadGraph(d)));
  }, []);

  const rows = useMemo(() => {
    if (!graph) return [];
    const all = new Set([...plan.taken, ...plan.planned]);
    const out: {
      id: string;
      label: string;
      taken: { satisfied: number; required: number };
      withPlanned: { satisfied: number; required: number };
    }[] = [];
    graph.forEachNode((id, a) => {
      if (a.kind !== "concentration") return;
      const t = concentrationProgress(graph, id, plan.taken);
      const wp = concentrationProgress(graph, id, all);
      if (wp.satisfied > 0) out.push({ id, label: a.label, taken: t, withPlanned: wp });
    });
    return out.sort(
      (a, b) =>
        b.taken.satisfied / Math.max(1, b.taken.required) -
        a.taken.satisfied / Math.max(1, a.taken.required)
    );
  }, [graph, plan.taken, plan.planned]);

  const unlocked = useMemo(
    () => (graph && plan.taken.size ? [...unlockedCourses(graph, plan.taken)].sort() : []),
    [graph, plan.taken]
  );

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 50% 20%, #232b45 0%, #151a2b 55%, #0d1120 100%)",
    color: "#d5dbe3",
    fontFamily: "system-ui",
    padding: "40px 24px 80px",
  };

  if (status === "loading" || plan.loading || !graph) {
    return <div style={{ ...page, display: "grid", placeItems: "center" }}>Loading…</div>;
  }

  if (!session) {
    return (
      <div style={{ ...page, display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Your concentration dashboard</h1>
          <p style={{ color: "#8a93a3" }}>Sign in with your Brown Google account to track progress.</p>
          <button
            onClick={() => signIn("google")}
            style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid #39496b", background: "#1c2434", color: "#8fb4e8", cursor: "pointer", fontSize: 14 }}
          >
            Sign in with Brown Google
          </button>
          <div style={{ marginTop: 16 }}>
            <Link href="/" style={{ color: "#7b8494" }}>← back to the map</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>My star chart</h1>
        <div style={{ color: "#8a93a3", fontSize: 13 }}>
          {plan.taken.size} taken · {plan.planned.size} planned · {unlocked.length} unlocked next
        </div>

        <h2 style={h2}>Constellation progress</h2>
        {rows.length === 0 && (
          <div style={{ color: "#8a93a3" }}>
            No progress yet. <Link href="/" style={{ color: "#8fb4e8" }}>Add courses on the map</Link> to see which concentrations open up.
          </div>
        )}
        {rows.slice(0, 20).map((r) => {
          const pctTaken = (100 * r.taken.satisfied) / Math.max(1, r.taken.required);
          const pctPlanned = (100 * r.withPlanned.satisfied) / Math.max(1, r.withPlanned.required);
          return (
            <div key={r.id} style={{ margin: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{r.label}</span>
                <span style={{ color: "#8a93a3" }}>
                  {r.taken.satisfied}/{r.taken.required}
                  {r.withPlanned.satisfied > r.taken.satisfied && (
                    <span style={{ color: "#b3a35c" }}> (+{r.withPlanned.satisfied - r.taken.satisfied} planned)</span>
                  )}
                </span>
              </div>
              <div style={{ background: "#1c2434", borderRadius: 6, height: 9, marginTop: 5, position: "relative" }}>
                <div style={{ width: `${Math.min(100, pctPlanned)}%`, background: "#575030", height: 9, borderRadius: 6, position: "absolute" }} />
                <div style={{ width: `${Math.min(100, pctTaken)}%`, background: "#8fd6a8", height: 9, borderRadius: 6, position: "absolute" }} />
              </div>
            </div>
          );
        })}

        {unlocked.length > 0 && (
          <>
            <h2 style={h2}>Within reach</h2>
            <div>
              {unlocked.slice(0, 60).map((c) => (
                <span key={c} style={{ display: "inline-block", margin: "2px 6px 2px 0", padding: "4px 10px", borderRadius: 6, background: "#33301a", color: "#e8cf7a", fontSize: 12 }}>
                  {c}
                </span>
              ))}
            </div>
          </>
        )}

        <h2 style={h2}>My courses</h2>
        <CourseList label="Taken" codes={[...plan.taken].sort()} color="#8fd6a8" onRemove={plan.remove} />
        <CourseList label="Planned" codes={[...plan.planned].sort()} color="#e8cf7a" onRemove={plan.remove} />
      </div>
      <AuthBar />
    </div>
  );
}

function CourseList({ label, codes, color, onRemove }: { label: string; codes: string[]; color: string; onRemove: (c: string) => void }) {
  if (!codes.length) return null;
  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "#7b8494", marginBottom: 4 }}>{label}</div>
      {codes.map((c) => (
        <span
          key={c}
          onClick={() => onRemove(c)}
          title="Click to remove"
          style={{ display: "inline-block", margin: "2px 6px 2px 0", padding: "4px 10px", borderRadius: 6, background: "#1c2434", color, fontSize: 12, cursor: "pointer" }}
        >
          {c} ✕
        </span>
      ))}
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: 14, textTransform: "uppercase", letterSpacing: 0.6, color: "#7b8494", margin: "28px 0 10px" };
