"use client";

import { useCallback, useSyncExternalStore } from "react";

function canMatch(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Whether a media query matches. The server and the first client render use `serverValue`, so
 * markup rendered without JavaScript is the same on every device; the real answer follows.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!canMatch()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => (canMatch() ? window.matchMedia(query).matches : serverValue),
    [query, serverValue],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
