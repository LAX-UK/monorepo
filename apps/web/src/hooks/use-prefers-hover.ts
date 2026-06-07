"use client";

import { useSyncExternalStore } from "react";

const query = "(hover: hover) and (pointer: fine)";

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

/** True when the primary input supports hover (desktop mouse/trackpad). */
export function usePrefersHover(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
