"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type Graph from "graphology";
import {
  loadGraph,
  prereqClosure,
  concentrationsOf,
  concentrationSubtree,
  type GraphExport,
  type ExportNode,
} from "@/lib/graph";
import { unlockedCourses } from "@/lib/unlock";
import { usePlan } from "@/lib/usePlan";
import { AuthBar } from "./AuthBar";
import { heightFor, courseLevel } from "@/lib/layout3d";
import { SearchBox } from "./SearchBox";
import { SidePanel } from "./SidePanel";
import { TakenPanel } from "./TakenPanel";
import { FilterPanel, type Filters, DEFAULT_FILTERS } from "./FilterPanel";

const ForceGraph3D = dynamic(() => import("./FG3D"), { ssr: false });

let SpriteTextCtor: any = null;
if (typeof window !== "undefined") {
  import("three-spritetext").then((m) => (SpriteTextCtor = m.default));
}

interface GNode {
  id: string;
  label: string;
  kind: string;
  dept?: string;
  color: string;
  size: number;
  fx: number;
  fy: number;
  fz: number;
}
interface GLink {
  source: string;
  target: string;
  etype: string;
}

export default function GraphView3D() {
  const fgRef = useRef<any>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [data, setData] = useState<GraphExport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ id: string; label: string; kind: string } | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const plan = usePlan();
  const { taken, planned } = plan;
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [layout, setLayout] = useState<"orbit" | "force">("force");

  const posOf = useCallback(
    (n: ExportNode): { x: number; y: number; z: number } => {
      if (layout === "orbit" && n.orbit) return n.orbit;
      if (layout === "force" && n.force) return n.force;
      return { x: n.x, y: heightFor(n), z: n.y };
    },
    [layout]
  );

  useEffect(() => {
    fetch("/graph.json")
      .then((r) => r.json())
      .then((d: GraphExport) => {
        setData(d);
        setGraph(loadGraph(d));
      });
  }, []);

  const unlocked = useMemo(
    () => (graph && taken.size ? unlockedCourses(graph, taken) : new Set<string>()),
    [graph, taken]
  );

  // Focus set: selection collapses the scene to the relevant subgraph.
  const focus = useMemo(() => {
    if (!graph || !selected || !graph.hasNode(selected)) return null;
    const kind = graph.getNodeAttribute(selected, "kind");
    if (kind === "course") {
      return new Set([
        selected,
        ...prereqClosure(graph, selected, "up"),
        ...prereqClosure(graph, selected, "down"),
        ...concentrationsOf(graph, selected),
      ]);
    }
    if (kind === "concentration") {
      return new Set([selected, ...concentrationSubtree(graph, selected)]);
    }
    return null;
  }, [graph, selected]);

  const passesFilters = useCallback(
    (n: ExportNode) => {
      if (n.kind === "concentration") return true;
      if (n.kind === "reqgroup") return false; // shown only via focus
      if (filters.depts.size > 0 && !filters.depts.has(n.dept ?? "")) return false;
      const lvl = courseLevel(n.id);
      if (lvl < filters.minLevel || lvl > filters.maxLevel) return false;
      return true;
    },
    [filters]
  );

  // Build the 3D dataset: focus overrides filters.
  const sceneData = useMemo(() => {
    if (!data || !graph) return { nodes: [] as GNode[], links: [] as GLink[] };
    const include = new Set<string>();
    for (const n of data.nodes) {
      if (focus ? focus.has(n.id) : passesFilters(n)) include.add(n.id);
    }
    // In overview, drop isolated courses if requested.
    let degreeOk: (id: string) => boolean = () => true;
    if (!focus && filters.hideIsolated) {
      const connected = new Set<string>();
      for (const e of data.edges) {
        if (e.type === "PREREQ_OF") {
          connected.add(e.source);
          connected.add(e.target);
        }
      }
      degreeOk = (id) => connected.has(id) || id.startsWith("conc:");
    }
    const nodes: GNode[] = data.nodes
      .filter((n) => include.has(n.id) && degreeOk(n.id))
      .map((n) => {
        const p = posOf(n);
        return {
          id: n.id,
          label: n.label,
          kind: n.kind,
          dept: n.dept,
          color: taken.has(n.id) ? "#6fe3c1" : planned.has(n.id) ? "#e8c47a" : unlocked.has(n.id) ? "#f0b070" : n.color,
          size: n.kind === "concentration" ? 9 : Math.max(3.2, n.size * 1.6),
          fx: p.x,
          fz: p.z,
          fy: p.y,
        };
      });
    const present = new Set(nodes.map((n) => n.id));
    const links: GLink[] = data.edges
      .filter((e) => present.has(e.source) && present.has(e.target))
      .filter((e) => (focus ? true : e.type === "PREREQ_OF"))
      .map((e) => ({ source: e.source, target: e.target, etype: e.type }));
    return { nodes, links };
  }, [data, graph, focus, passesFilters, filters.hideIsolated, taken, planned, unlocked, posOf]);

  const handleSelect = useCallback(
    (id: string | null) => {
      setSelected(id);
      if (!id && fgRef.current) {
        setTimeout(
          () => fgRef.current?.cameraPosition(layout === "force" ? { x: 720, y: 520, z: 720 } : { x: 560, y: 340, z: 560 }, { x: 0, y: layout === "force" ? 0 : 90, z: 0 }, 800),
          350
        );
      }
      if (id && fgRef.current && data) {
        // Manual framing: bbox of the focus set (fixed positions are known).
        setTimeout(() => {
          const kind = graph?.getNodeAttribute(id, "kind");
          const ids =
            kind === "concentration"
              ? new Set([id, ...concentrationSubtree(graph!, id)])
              : new Set([id, ...prereqClosure(graph!, id, "up"), ...prereqClosure(graph!, id, "down"), ...concentrationsOf(graph!, id)]);
          // Frame courses (and the selected node) only: distant concentration
          // nodes would otherwise blow up the bbox in galaxy layout.
          const frameIds = new Set(
            [...ids].filter((i) => i === id || !i.startsWith("conc:"))
          );
          let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
          for (const n of data.nodes) {
            if (!frameIds.has(n.id)) continue;
            const { x, y, z } = posOf(n);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
          }
          const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
          const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 60);
          const d = span * 1.35;
          fgRef.current?.cameraPosition({ x: cx + d, y: cy + span * 0.35, z: cz + d }, { x: cx, y: cy, z: cz }, 800);
        }, 350);
      }
    },
    [data, graph, posOf]
  );

  // Starfield backdrop added directly to the three.js scene.
  useEffect(() => {
    if (!fgRef.current || !graph) return;
    const t = setTimeout(async () => {
      const fg = fgRef.current;
      if (!fg || fg.__starsAdded) return;
      const THREE = await import("three");
      const scene = fg.scene();
      const makeStars = (count: number, spread: number, size: number, color: number, opacity: number) => {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * spread;
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true, depthWrite: false });
        return new THREE.Points(geo, mat);
      };
      scene.add(makeStars(2600, 4200, 2.0, 0xcdd6f0, 0.6));
      scene.add(makeStars(1600, 3200, 1.1, 0x7d8fd0, 0.45));
      scene.add(makeStars(240, 2400, 3.2, 0xe8d9b0, 0.5));
      scene.add(makeStars(120, 2000, 2.6, 0xc490d8, 0.35));
      // Soft bloom so nodes glow like stars.
      try {
        const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
        const bloom = new UnrealBloomPass(undefined as any, 1.15, 0.7, 0.1);
        fg.postProcessingComposer().addPass(bloom);
      } catch (e) {
        console.warn("bloom unavailable", e);
      }
      fg.__starsAdded = true;
    }, 300);
    return () => clearTimeout(t);
  }, [graph]);

  // Initial camera: slightly above the intro band, looking at the core.
  useEffect(() => {
    if (!fgRef.current || sceneData.nodes.length === 0) return;
    const t = setTimeout(() => {
      const c = layout === "force" ? { x: 720, y: 520, z: 720 } : { x: 560, y: 340, z: 560 };
      fgRef.current?.cameraPosition(c, { x: 0, y: layout === "force" ? 0 : 90, z: 0 }, 0);
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, layout]);

  if (!graph || !data) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "radial-gradient(ellipse at 62% 26%, #120e2b 0%, #0a0a20 40%, #050510 72%, #010208 100%)", color: "#98a2b3", fontFamily: "system-ui" }}>
        Charting the course constellations…
      </div>
    );
  }

  return (
    <div
      onMouseMove={(e) => {
        mouse.current = { x: e.clientX, y: e.clientY };
      }}
      style={{ position: "relative", height: "100vh", overflow: "hidden", background: "radial-gradient(ellipse at 62% 26%, #120e2b 0%, #0a0a20 40%, #050510 72%, #010208 100%)" }}>
      <ForceGraph3D
        fgRef={fgRef}
        graphData={sceneData}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        nodeLabel={() => ""}
        onNodeHover={(n: any) => setHovered(n ? { id: n.id, label: n.label, kind: n.kind } : null)}
        nodeColor={(n: any) => n.color}
        nodeVal={(n: any) => n.size}
        nodeOpacity={0.92}
        nodeResolution={12}
        linkColor={(l: any) =>
          l.etype === "PREREQ_OF" ? (focus ? "#d98cb8" : "#5d6cb0") : l.etype === "FULFILLS" ? "#c4a35e" : "#3f4a7a"
        }
        linkOpacity={focus ? 0.6 : 0.22}
        linkWidth={(l: any) => (focus && l.etype === "PREREQ_OF" ? 1.1 : 0.35)}
        linkDirectionalParticles={(l: any) => (focus && l.etype === "PREREQ_OF" ? 2 : 0)}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleSpeed={0.006}
        onNodeClick={(n: any) => handleSelect(n.id === selected ? null : n.id)}
        onBackgroundClick={() => handleSelect(null)}
        nodeThreeObjectExtend={true}
        nodeThreeObject={(n: any) => {
          const showLabel = n.kind === "concentration" || (focus && focus.has(n.id));
          if (!showLabel || !SpriteTextCtor) return undefined as any;
          const sprite = new SpriteTextCtor(
            n.kind === "concentration" ? n.label.replace(/ \(/, "\n(") : n.label
          );
          sprite.color = n.kind === "concentration" ? "#f2d9a0" : "#dbe2ec";
          sprite.textHeight = n.kind === "concentration" ? 4.4 : 3.0;
          sprite.position.y = n.size + 4;
          sprite.material.depthWrite = false;
          return sprite;
        }}
        enableNodeDrag={false}
        onNodeDrag={undefined}
        cooldownTicks={0}
        warmupTicks={0}
      />
      {hovered && (
        <div
          style={{
            position: "fixed",
            left: mouse.current.x + 14,
            top: mouse.current.y - 10,
            pointerEvents: "none",
            background: "rgba(8,9,24,.85)",
            border: "1px solid rgba(124,131,255,.35)",
            borderRadius: 6,
            padding: "4px 9px",
            fontFamily: "system-ui",
            fontSize: 11.5,
            letterSpacing: 0.3,
            color: hovered.kind === "concentration" ? "#ffd479" : "#c9d2ea",
            zIndex: 40,
            backdropFilter: "blur(4px)",
            whiteSpace: "nowrap",
          }}
        >
          {hovered.label}
        </div>
      )}
      <SearchBox graph={graph} onSelect={handleSelect} dark />
      <div style={{ position: "absolute", top: 12, right: selected ? 372 : 12, display: "flex", gap: 6, zIndex: 20, fontFamily: "system-ui", fontSize: 12 }}>
        {(["orbit", "force"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLayout(l)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid #2b2d52",
              background: layout === l ? "#2b5c9e" : "rgba(13,14,32,.92)",
              color: layout === l ? "#fff" : "#9aa4b2",
              cursor: "pointer",
            }}
          >
            {l === "orbit" ? "Orbit" : "Galaxy"}
          </button>
        ))}
      </div>
      <FilterPanel graph={graph} filters={filters} setFilters={setFilters} focused={!!focus} onClearFocus={() => handleSelect(null)} />
      {selected && graph.hasNode(selected) && (
        <SidePanel graph={graph} nodeId={selected} plan={plan} onClose={() => handleSelect(null)} onNavigate={handleSelect} />
      )}
      <TakenPanel graph={graph} plan={plan} />
      <AuthBar />
      <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 11, color: "#5c6673", fontFamily: "system-ui", pointerEvents: "none" }}>
        {layout === "orbit"
          ? "orbit view: courses circle the concentrations they feed · height = prerequisite depth"
          : "galaxy view: connected courses gravitate into constellations"} ·
        {" "}{data.meta.counts.course} courses · data: Brown Bulletin + Courses@Brown · unofficial
      </div>
    </div>
  );
}
