export const PALETTE_OPEN_EVENT = "lax-command-palette-open";

let pendingOpen = false;

export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  pendingOpen = true;
  window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
}

/** Consumes a palette open requested before the lazy chunk mounted. */
export function takePendingPaletteOpen(): boolean {
  const wasPending = pendingOpen;
  pendingOpen = false;
  return wasPending;
}

export function clearPendingPaletteOpen(): void {
  pendingOpen = false;
}
