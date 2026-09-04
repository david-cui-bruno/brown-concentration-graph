"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import {
  loadGraph,
  prereqClosure,
  concentrationsOf,
  concentrationSubtree,
  type GraphExport,
} from "@/lib/graph";
import { unlockedCourses } from "@/lib/unlock";
import { SearchBox } from "./SearchBox";
import { SidePanel } from "./SidePanel";
import { TakenPanel } from "./TakenPanel";

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<GraphExport["meta"] | null>(null);

  // Load graph data once.
  useEffect(() => {
    fetch("/graph.json")
      .then((r) => r.json())
      .then((data: GraphExport) => {
        setGraph(loadGraph(data));
        setMeta(data.meta);
      });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("takenCourses");
    if (saved) setTaken(new Set(JSON.parse(saved)));
  }, []);
  useEffect(() => {
    localStorage.setItem("takenCourses", JSON.stringify([...taken]));
  }, [taken]);

  // Derived highlight sets.
  const highlights = useMemo(() => {
    if (!graph) return null;
    const unlocked = taken.size ? unlockedCourses(graph, taken) : new Set<string>();
    if (selected && graph.hasNode(selected)) {
      const kind = graph.getNodeAttribute(selected, "kind");
      if (kind === "course") {
        const up = prereqClosure(graph, selected, "up");
        const down = prereqClosure(graph, selected, "down");
        const concs = concentrationsOf(graph, selected);
        return { focus: new Set([selected, ...up, ...down, ...concs]), unlocked };
      }
      if (kind === "concentration") {
        const sub = concentrationSubtree(graph, selected);
        return { focus: new Set([selected, ...sub]), unlocked };
      }
    }
    if (isolated && graph.hasNode(isolated)) {
      const sub = concentrationSubtree(graph, isolated);
      return { focus: new Set([isolated, ...sub]), unlocked };
    }
    return { focus: null as Set<string> | null, unlocked };
  }, [graph, selected, isolated, taken]);

  // Mount sigma.
  useEffect(() => {
    if (!graph || !containerRef.current) return;
    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      labelRenderedSizeThreshold: 8,
      defaultEdgeColor: "#dcdfe4",
      minCameraRatio: 0.02,
      maxCameraRatio: 5,
    });
    sigmaRef.current = sigma;
    sigma.on("clickNode", ({ node }) => {
      const kind = graph.getNodeAttribute(node, "kind");
      if (kind === "concentration") {
        setIsolated((cur) => (cur === node ? null : node));
        setSelected(node);
      } else if (kind === "course") {
        setSelected((cur) => (cur === node ? null : node));
      }
    });
    sigma.on("clickStage", () => {
      setSelected(null);
      setIsolated(null);
    });
    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [graph]);

  // Reducers react to highlight state.
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma || !graph || !highlights) return;
    const { focus, unlocked } = highlights;
    sigma.setSetting("nodeReducer", (node, data) => {
      const kind = graph.getNodeAttribute(node, "kind");
      const res: Record<string, unknown> = { ...data };
      if (kind === "reqgroup" && (!focus || !focus.has(node))) {
        res.hidden = true;
        return res;
      }
      if (taken.has(node)) {
        res.color = "#1a9850";
        res.zIndex = 2;
      } else if (unlocked.has(node)) {
        res.color = "#f5a623";
        res.zIndex = 2;
      }
      if (focus) {
        if (focus.has(node)) {
          res.zIndex = 3;
          res.forceLabel = kind !== "reqgroup";
        } else {
          res.color = "#e8eaed";
          res.label = "";
          res.zIndex = 0;
        }
      }
      return res;
    });
    sigma.setSetting("edgeReducer", (edge, data) => {
      const res: Record<string, unknown> = { ...data };
      const type = graph.getEdgeAttribute(edge, "type");
      const s = graph.source(edge);
      const t = graph.target(edge);
      if (focus) {
        if (focus.has(s) && focus.has(t)) {
          res.color = type === "PREREQ_OF" ? "#c0392b" : "#7f8fa6";
          res.size = type === "PREREQ_OF" ? 1.6 : 0.8;
          res.zIndex = 2;
        } else {
          res.hidden = true;
        }
      } else if (type !== "PREREQ_OF") {
        // In overview mode show only prereq structure to keep it readable.
        res.hidden = graph.getNodeAttribute(t, "kind") === "reqgroup";
        res.color = "#eceef1";
      }
      return res;
    });
    sigma.refresh();
  }, [graph, highlights, taken]);

  if (!graph) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", fontFamily: "system-ui" }}>
        Loading course graph…
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <SearchBox
        graph={graph}
        onSelect={(id) => {
          setSelected(id);
          const kind = graph.getNodeAttribute(id, "kind");
          setIsolated(kind === "concentration" ? id : null);
          // center camera on node
          const sigma = sigmaRef.current;
          if (sigma) {
            const pos = sigma.getNodeDisplayData(id);
            if (pos) sigma.getCamera().animate({ x: pos.x, y: pos.y, ratio: 0.08 }, { duration: 400 });
          }
        }}
      />
      {selected && graph.hasNode(selected) && (
        <SidePanel graph={graph} nodeId={selected} taken={taken} onClose={() => setSelected(null)} onNavigate={setSelected} />
      )}
      <TakenPanel graph={graph} taken={taken} setTaken={setTaken} />
      {meta && (
        <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 11, color: "#8a8f98", fontFamily: "system-ui" }}>
          {String(meta.counts.course ?? "?")} courses · {String(meta.counts.concentration ?? "?")} concentration tracks ·
          data: Brown Bulletin + Courses@Brown · unofficial
        </div>
      )}
    </div>
  );
}
