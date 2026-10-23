/**
 * GAP's `TimezoneId` is a Windows timezone ID. Only zones LAX sells in are mapped; an unknown
 * zone is a configuration error rather than something to guess.
 */
const IANA_TO_WINDOWS: Readonly<Record<string, string>> = {
  "Europe/London": "GMT Standard Time",
  "Europe/Dublin": "GMT Standard Time",
  "Europe/Lisbon": "GMT Standard Time",
  "Europe/Paris": "Romance Standard Time",
  "Europe/Brussels": "Romance Standard Time",
  "Europe/Madrid": "Romance Standard Time",
  "Europe/Berlin": "W. Europe Standard Time",
  "Europe/Amsterdam": "W. Europe Standard Time",
  "Europe/Rome": "W. Europe Standard Time",
  "Europe/Zurich": "W. Europe Standard Time",
  "America/New_York": "Eastern Standard Time",
  "Asia/Dubai": "Arabian Standard Time",
  UTC: "UTC",
  "Etc/UTC": "UTC",
};

export function toWindowsTimezoneId(ianaZone: string): string {
  const mapped = IANA_TO_WINDOWS[ianaZone];
  if (!mapped) {
    throw new Error(`No Windows timezone mapping for "${ianaZone}"`);
  }
  return mapped;
}
