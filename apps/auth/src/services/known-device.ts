import { createHash } from "node:crypto";
import { formatDeviceLabel } from "@auction/identity-contracts";

/** A device not seen for this long counts as new again, so an old stolen session cookie cannot hide behind history. */
export const KNOWN_DEVICE_WINDOW_MS = 90 * 24 * 60 * 60 * 1_000;

/** New-device emails per person per day, so a flurry of sign-ins cannot be used to flood an inbox. */
export const NEW_DEVICE_NOTICES_PER_DAY = 3;
export const NEW_DEVICE_NOTICE_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type KnownDeviceStore = {
  /** Records a sign-in and reports what was known about the person and device beforehand. */
  touch(input: { userId: string; fingerprint: string; at: Date }): Promise<{
    previousLastSeenAt: Date | null;
    /** Whether the person had signed in from any other device before. */
    hadOtherDevices: boolean;
  }>;
  /**
   * Whether the person has signed in from the browser holding this private device marker within
   * the last 90 days (`KNOWN_DEVICE_WINDOW_MS` before `at`). Also answers for the "owes a notice"
   * key of `fingerprintMarkerOwingNotice`.
   */
  hasSeen(input: { userId: string; fingerprint: string; at: Date }): Promise<boolean>;
  /** Remembers a device (or browser marker) without reporting anything about it. */
  remember(input: { userId: string; fingerprint: string; at: Date }): Promise<void>;
  /** Forgets these keys of the person: the browser is no longer vouched for, or no longer owes a notice. */
  forget(input: { userId: string; fingerprints: readonly string[] }): Promise<void>;
  countNoticesSince(userId: string, since: Date): Promise<number>;
  markNotified(input: { userId: string; fingerprint: string; at: Date }): Promise<void>;
};

/**
 * A stable, privacy-preserving key for the device behind a sign-in: a hash of the person, the
 * browser and system label (without versions, so a browser auto-update is not a new device) and a
 * coarse region. The user agent string and the region are not stored, only this hash.
 */
export function fingerprintDevice(input: {
  userId: string;
  userAgent: string | null;
  region: string | null;
}): string {
  const label = formatDeviceLabel(input.userAgent);
  const region = input.region?.trim().toUpperCase() ?? "";
  return createHash("sha256").update(`${input.userId}\n${label}\n${region}`).digest("hex");
}

/**
 * The key for a browser that carries the sign-in service's private device marker: a hash of the
 * person and the keyed hash of the marker. It tells two browsers with the same label and country
 * apart, and a browser that updates or travels stays the same one.
 */
export function fingerprintMarker(input: { userId: string; deviceHash: string }): string {
  return createHash("sha256").update(`${input.userId}\nmarker\n${input.deviceHash}`).digest("hex");
}

/**
 * The key that says the browser holding this marker owes the person a new sign-in email: it was
 * signed out from the devices list (or by a password reset or a support reset), or its last
 * notice could not be queued. Its next sign-in is treated as new whatever its label or country
 * says. Kept apart from `fingerprintMarker`, so one row never means both "known" and "owed".
 */
export function fingerprintMarkerOwingNotice(input: {
  userId: string;
  deviceHash: string;
}): string {
  return createHash("sha256")
    .update(`${input.userId}\nmarker-owes-notice\n${input.deviceHash}`)
    .digest("hex");
}

/**
 * Whether a sign-in from a device deserves an email: the person has signed in from other devices
 * (a first ever sign-in is not news) but not from this one in the last 90 days.
 */
export function isNewDevice(
  seen: { previousLastSeenAt: Date | null; hadOtherDevices: boolean },
  at: Date,
): boolean {
  if (seen.previousLastSeenAt) {
    return at.getTime() - seen.previousLastSeenAt.getTime() > KNOWN_DEVICE_WINDOW_MS;
  }
  return seen.hadOtherDevices;
}
