"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type PlanStatus = "taken" | "planned";
export interface PlanState {
  taken: Set<string>;
  planned: Set<string>;
  setStatus: (code: string, status: PlanStatus) => void;
  remove: (code: string) => void;
  signedIn: boolean;
  loading: boolean;
}

const LS_KEY = "takenCourses"; // legacy local key (array of codes, all "taken")
const LS_PLAN = "planCourses";

/**
 * Course plan: server-backed for signed-in users, localStorage for guests.
 * On first sign-in, local courses merge into the account (then local is cleared).
 */
export function usePlan(): PlanState {
  const { data: session, status: authStatus } = useSession();
  const signedIn = !!session?.user?.email;
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [planned, setPlanned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load
  useEffect(() => {
    if (authStatus === "loading") return;
    if (signedIn) {
      (async () => {
        // migrate local first
        const localTaken: string[] = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
        const localPlanned: string[] = JSON.parse(localStorage.getItem(LS_PLAN) ?? "[]");
        if (localTaken.length || localPlanned.length) {
          await fetch("/api/plan", {
            method: "POST",
            body: JSON.stringify({
              bulk: [
                ...localTaken.map((code) => ({ code, status: "taken" })),
                ...localPlanned.map((code) => ({ code, status: "planned" })),
              ],
            }),
          });
          localStorage.removeItem(LS_KEY);
          localStorage.removeItem(LS_PLAN);
        }
        const res = await fetch("/api/plan");
        const { courses } = await res.json();
        setTaken(new Set(courses.filter((c: any) => c.status === "taken").map((c: any) => c.code)));
        setPlanned(new Set(courses.filter((c: any) => c.status === "planned").map((c: any) => c.code)));
        setLoading(false);
      })();
    } else {
      setTaken(new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")));
      setPlanned(new Set(JSON.parse(localStorage.getItem(LS_PLAN) ?? "[]")));
      setLoading(false);
    }
  }, [signedIn, authStatus]);

  const persistLocal = (t: Set<string>, p: Set<string>) => {
    localStorage.setItem(LS_KEY, JSON.stringify([...t]));
    localStorage.setItem(LS_PLAN, JSON.stringify([...p]));
  };

  const setStatus = useCallback(
    (code: string, status: PlanStatus) => {
      setTaken((t) => {
        const nt = new Set(t);
        status === "taken" ? nt.add(code) : nt.delete(code);
        setPlanned((p) => {
          const np = new Set(p);
          status === "planned" ? np.add(code) : np.delete(code);
          if (!signedIn) persistLocal(nt, np);
          return np;
        });
        return nt;
      });
      if (signedIn) {
        fetch("/api/plan", { method: "POST", body: JSON.stringify({ code, status }) });
      }
    },
    [signedIn]
  );

  const remove = useCallback(
    (code: string) => {
      setTaken((t) => {
        const nt = new Set(t);
        nt.delete(code);
        setPlanned((p) => {
          const np = new Set(p);
          np.delete(code);
          if (!signedIn) persistLocal(nt, np);
          return np;
        });
        return nt;
      });
      if (signedIn) {
        fetch("/api/plan", { method: "POST", body: JSON.stringify({ code, remove: true }) });
      }
    },
    [signedIn]
  );

  return { taken, planned, setStatus, remove, signedIn, loading };
}
