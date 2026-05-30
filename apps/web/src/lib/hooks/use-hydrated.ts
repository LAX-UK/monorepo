"use client";

import { useSyncExternalStore } from "react";

/** True only after the client has hydrated (false on server and during hydration). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
