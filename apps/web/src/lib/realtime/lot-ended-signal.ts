/**
 * A browser event the lot page sends when a lot closes (`lotEnded`). The header's outbid prompt
 * listens for it (see `lib/navigation/ended-lots.ts`) so it can drop a lot the moment it closes.
 * It is a plain window event so the lot page needs no store and the shared frame gains no module.
 * `LotRealtimeProvider` writes the name out rather than importing it, to keep the lot page's
 * scripts at their size; its test fails if the two differ.
 */
export const LOT_ENDED_SIGNAL = "lax:lotEnded";

export function announceLotEnded(lotId: string): void {
  window.dispatchEvent(new CustomEvent<string>(LOT_ENDED_SIGNAL, { detail: lotId }));
}
