import { normaliseViewerZone } from "./zone.js";

/** Where the visitor's zone came from; the panel says so ("from this device"). */
export type ViewerZoneSource = "device" | "chosen" | "account";

/** The zone to show a visitor their own time in, or nothing worth showing. */
export type ViewerZone = { zone: string; source: ViewerZoneSource } | null;

/** The first-party cookie that carries the visitor's zone (same handling as `lax_theme`). */
export const VIEWER_ZONE_COOKIE = "lax_tz";

export const VIEWER_ZONE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** Marks a zone the visitor picked, so the device's own zone no longer overwrites it. */
const CHOSEN_PREFIX = "fixed:";

function decode(raw: string): string {
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Reads the `lax_tz` value: "Africa/Cairo" is what the device reported, "fixed:Australia/Sydney"
 * is a zone the visitor chose. UTC, `Etc/*` and invalid names are no zone at all (TZ13).
 */
export function parseViewerZoneCookie(raw: string | null | undefined): ViewerZone {
  if (!raw) return null;
  const value = decode(raw);
  const chosen = value.startsWith(CHOSEN_PREFIX);
  const zone = normaliseViewerZone(chosen ? value.slice(CHOSEN_PREFIX.length) : value);
  return zone ? { zone, source: chosen ? "chosen" : "device" } : null;
}

/** The cookie value for a zone the visitor chose. */
export function chosenZoneCookieValue(zone: string): string {
  return `${CHOSEN_PREFIX}${zone}`;
}

/** The server's reading, in the order TZ8 sets: an Account choice, then the cookie, then unknown. */
export function resolveViewerZone(input: {
  account: string | null;
  cookie: string | null | undefined;
}): ViewerZone {
  const account = normaliseViewerZone(input.account);
  if (account) return { zone: account, source: "account" };
  return parseViewerZoneCookie(input.cookie);
}

/** A snapshot `useSyncExternalStore` can compare by value. */
export function encodeViewerZone(value: ViewerZone): string {
  return value ? `${value.source}|${value.zone}` : "";
}

export function decodeViewerZone(snapshot: string): ViewerZone {
  const bar = snapshot.indexOf("|");
  if (bar < 0) return null;
  const source = snapshot.slice(0, bar);
  if (source !== "device" && source !== "chosen" && source !== "account") return null;
  return { source, zone: snapshot.slice(bar + 1) };
}
