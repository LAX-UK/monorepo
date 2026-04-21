export const PALETTE_OPEN_EVENT = "lax-command-palette-open";

export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
}
