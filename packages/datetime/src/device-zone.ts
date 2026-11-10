import { normaliseViewerZone } from "./zone.js";

/**
 * The zone this browser reports, or `null` when it is missing, UTC or `Etc/*` (what privacy modes
 * send on purpose) or not one the runtime can compute with.
 */
export function deviceTimeZone(): string | null {
  try {
    return normaliseViewerZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}
