"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthBar() {
  const { data: session, status } = useSession();
  const path = usePathname();

  const pill: React.CSSProperties = {
    padding: "7px 14px",
    borderRadius: 8,
    border: "1px solid #2a3347",
    background: "rgba(17,22,34,.94)",
    color: "#9aa4b2",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "system-ui",
    textDecoration: "none",
  };

  return (
    <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", gap: 6, zIndex: 20 }}>
      {path !== "/" && (
        <Link href="/" style={pill}>
          Map
        </Link>
      )}
      {session && path !== "/me" && (
        <Link href="/me" style={{ ...pill, color: "#8fb4e8" }}>
          My star chart
        </Link>
      )}
      {status !== "loading" &&
        (session ? (
          <button onClick={() => signOut()} style={pill} title={session.user?.email ?? ""}>
            {session.user?.email?.split("@")[0]} · sign out
          </button>
        ) : (
          <button onClick={() => signIn("google")} style={{ ...pill, color: "#8fb4e8", borderColor: "#39496b" }}>
            Sign in with Brown Google
          </button>
        ))}
    </div>
  );
}
