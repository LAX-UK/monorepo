"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The one shared slot at the bottom of the screen. The tab bar normally holds it; a bar that
 * needs the same space (a live-lot bid bar, a pay bar) claims it, and the tab bar steps aside.
 */
const claims = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Claims the slot for `id`. Returns the release function. */
export function claimBottomSlot(id: string): () => void {
  claims.add(id);
  emit();
  return () => {
    claims.delete(id);
    emit();
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while some other bar holds the slot. */
export function useBottomSlotClaimed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => claims.size > 0,
    () => false,
  );
}

/** Holds the slot while `active` is true. Call it from the bar that needs the space. */
export function useClaimBottomSlot(id: string, active = true): void {
  useEffect(() => {
    if (!active) return;
    return claimBottomSlot(id);
  }, [id, active]);
}
