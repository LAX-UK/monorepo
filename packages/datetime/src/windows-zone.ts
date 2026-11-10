import { WINDOWS_ZONE_BY_IANA } from "./windows-zones.generated.js";

/**
 * The Windows zone ID for an IANA zone ("Europe/London" is "GMT Standard Time"), as ATG's GAP API
 * names zones, or `null` when CLDR has no entry for it.
 */
export function windowsZoneId(ianaZone: string): string | null {
  return Object.hasOwn(WINDOWS_ZONE_BY_IANA, ianaZone)
    ? (WINDOWS_ZONE_BY_IANA[ianaZone] ?? null)
    : null;
}
