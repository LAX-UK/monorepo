"use client";

import { useSyncExternalStore } from "react";

const query = "(min-width: 1024px)";

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

function getServerSnapshot() {
  return false;
}

/** True when viewport is `lg` breakpoint or wider (Tailwind `lg`). */
export function useIsLg(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
