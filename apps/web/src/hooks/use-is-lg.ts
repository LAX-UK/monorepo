"use client";

import { useSyncExternalStore } from "react";

const query = "(min-width: 1024px)";

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

/** True when viewport is `lg` breakpoint or wider (Tailwind `lg`). */
export function useIsLg(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
