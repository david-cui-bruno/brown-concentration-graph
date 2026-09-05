"use client";

import { useEffect, useState } from "react";

const KEY = "constellations-onboarded-v1";

export function Onboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);

  if (!show) return null;
  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <div
      onClick={dismiss}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        background: "rgba(2,3,12,.72)",
        backdropFilter: "blur(3px)",
        fontFamily: "system-ui",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 430px)",
          background: "rgba(13,14,32,.97)",
          border: "1px solid #2b2d52",
          borderRadius: 16,
          padding: "26px 28px",
          color: "#d5dbe3",
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 19 }}>The Brown course galaxy 🐻</h2>
        <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.7, color: "#aeb6c2" }}>
          <div>🐻 <b style={{ color: "#d5dbe3" }}>Drag</b> to orbit, <b style={{ color: "#d5dbe3" }}>scroll</b> to zoom</div>
          <div>🐻 <b style={{ color: "#d5dbe3" }}>Click a star</b>: course info + prereqs</div>
          <div>🐻 <b style={{ color: "#d5dbe3" }}>Gold stars</b>: concentrations</div>
          <div>🐻 Mark <b style={{ color: "#6fe3c1" }}>taken</b> / <b style={{ color: "#e8c47a" }}>planned</b>, sign in to sync</div>
        </div>
        <button
          onClick={dismiss}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "11px 0",
            borderRadius: 10,
            border: "1px solid #39496b",
            background: "#1a1c3a",
            color: "#8fb4e8",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Explore the sky
        </button>
      </div>
    </div>
  );
}
