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
 * Whether this device is somewhere other than the city the person fixed (a trip, a new laptop).
 * Nothing when the device's zone is unknown or the same. It only feeds the note under the value.
 */
export function deviceZoneOffer(
  preference: TimeZonePreferenceVm,
  deviceZone: string | null,
): { deviceZone: string; fixedZone: string } | null {
  if (preference.mode !== "fixed" || !deviceZone || deviceZone === preference.zone) return null;
  return { deviceZone, fixedZone: preference.zone };
}

/** The row's value and the one line under it. */
export type TimeZoneSummaryVm = { value: string; detail: string | null };

/**
 * What the Personal details row says. Automatic names the zone in use and where it came from; a
 * fixed city stands alone, and only a device somewhere else gets a note, so the difference is
 * explained without asking the person to do anything.
 */
export function timeZoneSummary(
  preference: TimeZonePreferenceVm,
  deviceZone: string | null,
  at: Date,
): TimeZoneSummaryVm {
  if (preference.mode === "automatic") {
    return preference.zone
      ? {
          value: `Automatic · ${zoneLabel(preference.zone, at)}`,
          detail:
            "Taken from this device. Sale times stay in London time, with yours next to them.",
        }
      : {
          value: "Automatic",
          detail: "We’ll use this device’s time zone the next time you visit.",
        };
  }
  const elsewhere = deviceZoneOffer(preference, deviceZone);
  return {
    value: zoneLabel(preference.zone, at),
    detail: elsewhere
      ? `This device is on ${cityName(elsewhere.deviceZone)} time. We still use ${cityName(elsewhere.fixedZone)}, as you chose.`
      : null,
  };
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
