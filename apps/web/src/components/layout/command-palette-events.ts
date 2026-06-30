import { useCommandPaletteStore } from "@/lib/stores/command-palette-store";

export const PALETTE_OPEN_EVENT = "lax-command-palette-open";

export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  useCommandPaletteStore.getState().requestOpen();
  window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
}

/** Consumes a palette open requested before the lazy chunk mounted. */
export function takePendingPaletteOpen(): boolean {
  return useCommandPaletteStore.getState().takePendingOpen();
}

export function clearPendingPaletteOpen(): void {
  useCommandPaletteStore.getState().clearPendingOpen();
}
