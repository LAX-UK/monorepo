import { cityName, gmtOffsetLabel, normaliseViewerZone } from "@auction/datetime";

/** What the person's LAX Account time zone is, as the Personal details section shows it. */
export type TimeZonePreferenceVm =
  /** Follows the device. `zone` is the one it reported on the last visit, or null before it has. */
  | { mode: "automatic"; zone: string | null }
  /** Always one city. */
  | { mode: "fixed"; zone: string };

/** "Sydney (GMT+11)": a city with its offset at `at`. */
export function zoneLabel(zone: string, at: Date): string {
  return `${cityName(zone)} (${gmtOffsetLabel(at, zone)})`;
}

/**
 * Reads the issuer's answer. A fixed choice without a usable zone cannot happen (the issuer
 * refuses it), but a bad name must never reach a date formatter, so it reads as no zone known.
 */
export function toTimeZonePreferenceVm(preference: {
  mode: "automatic" | "fixed";
  zone: string | null;
}): TimeZonePreferenceVm {
  const zone = normaliseViewerZone(preference.zone);
  if (preference.mode === "fixed" && zone) return { mode: "fixed", zone };
  return { mode: "automatic", zone };
}

/**
 * Whether to offer a switch to Automatic: the person fixed a city, and this device is somewhere
 * else (a trip, a new laptop). Nothing is offered when the device's zone is unknown or the same.
 */
export function deviceZoneOffer(
  preference: TimeZonePreferenceVm,
  deviceZone: string | null,
): { deviceZone: string; fixedZone: string } | null {
  if (preference.mode !== "fixed" || !deviceZone || deviceZone === preference.zone) return null;
  return { deviceZone, fixedZone: preference.zone };
}

/**
 * Whether this device's zone should be stored: only while the person follows their device, and
 * only when it differs from what is stored.
 */
export function shouldReportDeviceZone(
  preference: TimeZonePreferenceVm,
  deviceZone: string | null,
): deviceZone is string {
  return preference.mode === "automatic" && deviceZone !== null && deviceZone !== preference.zone;
}
