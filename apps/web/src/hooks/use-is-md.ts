"use client";

import { useSyncExternalStore } from "react";

const query = "(min-width: 768px)";

function matchMediaOrNull(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(query);
}

function subscribe(onStoreChange: () => void) {
  const mq = matchMediaOrNull();
  if (!mq) return () => {};
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return matchMediaOrNull()?.matches ?? false;
}

function getServerSnapshot() {
  return false;
}

/** True when viewport is `md` breakpoint or wider (Tailwind `md`, 768px). */
export function useIsMd(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
