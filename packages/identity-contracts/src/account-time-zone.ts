import { z } from "zod";
import { normalisePlaceZone } from "./place-zone.js";

/** Issuer routes LAX Account calls (under the Better Auth base path) for the time zone preference. */
export const ACCOUNT_TIME_ZONE_PATH = "/lax/account-time-zone";
export const ACCOUNT_TIME_ZONE_UPDATE_PATH = "/lax/account-time-zone/update";
/** Reports the zone a signed-in device is in; it only has an effect while the mode is automatic. */
export const ACCOUNT_TIME_ZONE_DEVICE_PATH = "/lax/account-time-zone/device";

/** "automatic" follows the device; "fixed" always uses one chosen city. */
export const ACCOUNT_TIME_ZONE_MODES = ["automatic", "fixed"] as const;
export type AccountTimeZoneMode = (typeof ACCOUNT_TIME_ZONE_MODES)[number];

/** What the issuer says when it refuses a zone: the name is not a real place zone. */
export const ACCOUNT_TIME_ZONE_ERRORS = ["invalid_time_zone"] as const;
export type AccountTimeZoneError = (typeof ACCOUNT_TIME_ZONE_ERRORS)[number];

/**
 * A real IANA place zone, the same rule the rest of LAX applies to a visitor's zone
 * (`normaliseViewerZone`): UTC, `Etc/*` and names the runtime does not know are refused (a
 * privacy mode reports UTC on purpose; it names no place).
 */
export const accountPlaceZoneSchema = z
  .string()
  .refine((zone) => normalisePlaceZone(zone) !== null, { message: "invalid_time_zone" });

/**
 * The preference as relying apps see it. In "fixed" mode `zone` is the chosen city. In
 * "automatic" mode it is the zone the person's device last reported, or null before any has.
 */
export const accountTimeZoneSchema = z.object({
  mode: z.enum(ACCOUNT_TIME_ZONE_MODES),
  zone: z.string().nullable(),
});

export type AccountTimeZone = z.infer<typeof accountTimeZoneSchema>;

/** The zone to use for this person's emails and times, or null when none is known yet. */
export function effectiveAccountTimeZone(preference: AccountTimeZone): string | null {
  return normalisePlaceZone(preference.zone);
}

/**
 * A change the person asks for. Automatic carries the device's current zone, which an
 * unrecognisable reading (UTC, nothing) turns into "none yet" instead of a refusal. Fixed must
 * name a real place.
 */
export type AccountTimeZoneChange =
  | { mode: "automatic"; deviceZone: string | null }
  | { mode: "fixed"; zone: string };

/** Reads the form fields of an update request; null when they do not describe a valid change. */
export function parseAccountTimeZoneChange(fields: {
  mode: string | null;
  zone: string | null;
}): AccountTimeZoneChange | null {
  if (fields.mode === "automatic") {
    return { mode: "automatic", deviceZone: normalisePlaceZone(fields.zone) };
  }
  if (fields.mode === "fixed") {
    const zone = accountPlaceZoneSchema.safeParse(fields.zone);
    return zone.success ? { mode: "fixed", zone: zone.data } : null;
  }
  return null;
}
