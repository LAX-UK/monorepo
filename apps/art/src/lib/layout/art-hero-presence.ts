import { useSyncExternalStore } from "react";

/*
 * Whether the page currently rendered has a hero under the header. Heroes register on mount, so a
 * page without an image (or a slower streamed one) is reflected without the layout knowing the data.
 */
let heroCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function registerArtHero(): () => void {
  heroCount += 1;
  emit();
  return () => {
    heroCount -= 1;
    emit();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The server cannot see mounted heroes; it renders assuming one, matching `artRouteMayHaveHero`. */
export function useArtHeroPresent(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => heroCount > 0,
    () => true,
  );
}
