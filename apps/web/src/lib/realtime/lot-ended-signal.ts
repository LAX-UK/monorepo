/**
 * A browser event the lot page sends when its lot closes (`lotEnded`). The header's outbid prompt
 * listens for it (see `lib/navigation/ended-lots.ts`) so it can drop a lot the moment it closes.
 * It is a plain window event so the lot page needs no store and the shared frame gains no module.
 */
export const LOT_ENDED_SIGNAL = "lax:lot-ended";

export function announceLotEnded(lotId: string): void {
  window.dispatchEvent(new CustomEvent<string>(LOT_ENDED_SIGNAL, { detail: lotId }));
}
