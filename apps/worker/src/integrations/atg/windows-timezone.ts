import { windowsZoneId } from "@auction/datetime";

/**
 * GAP's `TimezoneId` is a Windows timezone ID. A sale's IANA zone maps through the CLDR table in
 * `@auction/datetime`; a zone with no entry is an error rather than something to guess.
 */
export function toWindowsTimezoneId(ianaZone: string): string {
  const mapped = windowsZoneId(ianaZone);
  if (!mapped) {
    throw new Error(`No Windows timezone mapping for "${ianaZone}"`);
  }
  return mapped;
}
