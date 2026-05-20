/** Session marker so the lot detail hero can pair with the clicked list tile. */

const STORAGE_KEY = "auction:pending-lot-view-transition";

export function markPendingLotViewTransition(lotId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, lotId);
}

/** Returns the pending lot id and clears it (one-shot). */
export function consumePendingLotViewTransition(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const id = sessionStorage.getItem(STORAGE_KEY);
  if (id) sessionStorage.removeItem(STORAGE_KEY);
  return id;
}
