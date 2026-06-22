"use client";

import * as React from "react";

const STORAGE_KEY = "lax.reduceMotion";

type Override = "system" | "force-reduce" | "force-allow";

function readOverride(): Override {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "force-reduce" || v === "force-allow") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

/** F9 — `useReducedMotion()` — single source of truth combining the OS
 * preference and an in-app override saved in `localStorage`.
 *
 * The CSS layer also respects `(prefers-reduced-motion: reduce)` directly;
 * this hook is for components that need to branch on the value (e.g.,
 * disable a sound effect, skip an inline animation in a render path).
 */
export function useReducedMotion(): boolean {
  /** SSR and first client paint must match; read OS / localStorage only after mount. */
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    function recompute() {
      const override = readOverride();
      if (override === "force-reduce") return setReduced(true);
      if (override === "force-allow") return setReduced(false);
      setReduced(mq.matches);
    }

    recompute();
    mq.addEventListener("change", recompute);

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) recompute();
    }
    window.addEventListener("storage", onStorage);

    return () => {
      mq.removeEventListener("change", recompute);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return reduced;
}

/** Imperative setter for the in-app override. Settings UI calls this. */
export function setReducedMotionOverride(next: Override) {
  if (typeof window === "undefined") return;
  try {
    if (next === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    document.documentElement.dataset.reduceMotion = next;
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    /* ignore */
  }
}

export function readReducedMotionOverride(): Override {
  return readOverride();
}
