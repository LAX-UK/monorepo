"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/**
 * False while this part of the page hydrates and true from the commit that follows, which is the
 * commit where the time chips switch from the server's reading of the zone to the browser's. On a
 * page that was never server-rendered it is true at once.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
