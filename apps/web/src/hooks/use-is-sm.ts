"use client";

import { useSyncExternalStore } from "react";

const query = "(min-width: 640px)";

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

/** True when viewport is `sm` breakpoint or wider (Tailwind `sm`, 640px). */
export function useIsSm(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
