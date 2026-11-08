"use client";

import { useSyncExternalStore } from "react";

export type HeroPresence = {
  /** A hero that starts under the header calls this on mount; the returned function releases it. */
  register(): () => void;
  /** Whether any hero is mounted now. */
  useHeroPresent(): boolean;
};

/**
 * Whether the page on screen has a hero under the header, kept apart from the layout so the header
 * can turn transparent without knowing the page's data: each hero registers when it mounts and
 * lets go when it unmounts, so a page without a picture (or a streamed one that arrives late) is
 * reflected as it happens.
 *
 * `assumedOnServer` is what the server-rendered header assumes before anything has mounted. Bid
 * assumes none (a solid header is always readable); a product whose heroes always exist on a route
 * may assume one.
 */
export function createHeroPresence(options: { assumedOnServer: boolean }): HeroPresence {
  let count = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    register() {
      count += 1;
      emit();
      return () => {
        count -= 1;
        emit();
      };
    },
    useHeroPresent() {
      return useSyncExternalStore(
        subscribe,
        () => count > 0,
        () => options.assumedOnServer,
      );
    },
  };
}
