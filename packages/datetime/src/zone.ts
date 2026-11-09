import { LOCALE } from "./constants.js";

let supported: ReadonlySet<string> | undefined;

function supportedZones(): ReadonlySet<string> {
  supported ??= new Set(Intl.supportedValuesOf("timeZone"));
  return supported;
}

/** Older browsers still report retired aliases ("Asia/Calcutta"); the runtime resolves them. */
function runtimeAcceptsZone(zone: string): boolean {
  if (!zone.includes("/")) return false;
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** True for an IANA zone name the runtime can compute with. */
export function isValidZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone === "") return false;
  return supportedZones().has(zone) || runtimeAcceptsZone(zone);
}

/** UTC and the fixed `Etc/*` zones are what privacy modes report on purpose; they name no place. */
export function isPlaceholderZone(zone: string): boolean {
  return zone === "UTC" || zone === "GMT" || zone.startsWith("Etc/");
}

/**
 * The zone to show a visitor their own time in, or `null` when there is nothing trustworthy to
 * show: missing, invalid, UTC or `Etc/*`. A person who deliberately picks UTC is the caller's
 * business and goes through `isValidZone` instead.
 */
export function normaliseViewerZone(zone: unknown): string | null {
  if (!isValidZone(zone) || isPlaceholderZone(zone)) return null;
  return zone;
}
