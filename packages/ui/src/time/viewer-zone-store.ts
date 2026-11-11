import {
  VIEWER_ZONE_COOKIE,
  VIEWER_ZONE_COOKIE_MAX_AGE_SEC,
  type ViewerZone,
  chosenZoneCookieValue,
  deviceTimeZone,
  encodeViewerZone,
  parseViewerZoneCookie,
} from "@auction/datetime";
import { readCookie } from "../lib/read-cookie.js";

const CHANGE_EVENT = "lax:viewer-zone-change";

/**
 * The browser's own reading: a zone the visitor chose wins, then the device's zone. It does not
 * need the cookie, so a visitor who declines it still sees their time on every page.
 */
export function readClientViewerZone(): ViewerZone {
  const stored = parseViewerZoneCookie(readCookie(document.cookie, VIEWER_ZONE_COOKIE));
  if (stored?.source === "chosen") return stored;
  const zone = deviceTimeZone();
  return zone ? { zone, source: "device" } : null;
}

/**
 * What a signed-in person just saved to LAX Account, applied here at once. The server reads Bid's
 * copy of the choice, which only catches up when the worker has projected the identity event, so
 * the refresh that follows a save can still draw the old zone. In memory only: the next full load
 * reads the server again.
 */
let accountOverride: ViewerZone | undefined;

export function setAccountViewerZone(saved: { mode: "automatic" | "fixed"; zone: string | null }) {
  if (saved.mode === "fixed" && saved.zone) {
    accountOverride = { zone: saved.zone, source: "account" };
  } else {
    // Automatic follows the device (and shows no zone when the device reports none).
    const zone = deviceTimeZone();
    accountOverride = zone ? { zone, source: "device" } : null;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Forgets the override, as a full page load would, and tells every chip. */
export function clearAccountViewerZone(): void {
  if (accountOverride === undefined) return;
  accountOverride = undefined;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function overrideAgreesWith(
  override: ViewerZone,
  saved: { mode: "automatic" | "fixed"; zone: string | null },
): boolean {
  if (saved.mode === "fixed") return override?.source === "account" && override.zone === saved.zone;
  // Automatic: the override reads the device, and the server holds the zone it reported.
  return (
    (override === null || override.source === "device") && (override?.zone ?? null) === saved.zone
  );
}

/**
 * Drops the override once the server's copy no longer needs it: the signed-in person's saved
 * choice now says the same, or they have signed out (`null`). Until then it keeps showing the
 * zone they just saved.
 */
export function reconcileAccountViewerZone(
  saved: { mode: "automatic" | "fixed"; zone: string | null } | null,
): void {
  if (accountOverride === undefined) return;
  if (saved === null) {
    clearAccountViewerZone();
    return;
  }
  const caughtUp = overrideAgreesWith(accountOverride, saved);
  if (caughtUp) clearAccountViewerZone();
}

/** The override as a snapshot `useSyncExternalStore` can compare; `null` means there is none. */
export function getAccountViewerZoneSnapshot(): string | null {
  return accountOverride === undefined ? null : encodeViewerZone(accountOverride);
}

export function getClientViewerZoneSnapshot(): string {
  return encodeViewerZone(readClientViewerZone());
}

export function subscribeViewerZone(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Saves a zone the visitor chose on this device only, and tells every chip on the page. */
export function saveChosenViewerZone(zone: string): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${VIEWER_ZONE_COOKIE}=${encodeURIComponent(chosenZoneCookieValue(zone))}; path=/; max-age=${VIEWER_ZONE_COOKIE_MAX_AGE_SEC}; samesite=lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Goes back to following the device: the plain device zone is stored (the head script keeps it
 * current), or the cookie is cleared when the device reports no usable zone. Tells every chip.
 */
export function followDeviceViewerZone(): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  const zone = deviceTimeZone();
  document.cookie = zone
    ? `${VIEWER_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${VIEWER_ZONE_COOKIE_MAX_AGE_SEC}; samesite=lax${secure}`
    : `${VIEWER_ZONE_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
