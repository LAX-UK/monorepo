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

export function getClientViewerZoneSnapshot(): string {
  return encodeViewerZone(readClientViewerZone());
}

export function subscribeViewerZone(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Saves a zone the visitor chose on this device only, and tells every chip on the page. */
export function saveChosenViewerZone(zone: string): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${VIEWER_ZONE_COOKIE}=${encodeURIComponent(chosenZoneCookieValue(zone))}; path=/; max-age=${VIEWER_ZONE_COOKIE_MAX_AGE_SEC}; samesite=lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
