import { createHmac, randomBytes } from "node:crypto";

/**
 * The private device marker: a strictly necessary security cookie that only the sign-in service
 * sets and reads. It tells the issuer that a new sign-in comes from the same browser as an earlier
 * one, so the new sign-in can replace the old record instead of adding another. It never decides
 * whether anyone is signed in, and it never leaves the issuer's own host (`__Host-` prefix: no
 * Domain, Path=/, Secure).
 */
export const DEVICE_MARKER_COOKIE = "__Host-lax_device";

/** 400 days, the longest a browser keeps a cookie; renewed on use. */
export const DEVICE_MARKER_MAX_AGE_SEC = 400 * 24 * 60 * 60;

const MARKER_BYTES = 16;
/** 128 random bits as unpadded base64url. */
const MARKER_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const KEY_LABEL = "lax:device-marker:v1";

export function mintDeviceMarker(): string {
  return randomBytes(MARKER_BYTES).toString("base64url");
}

/** The marker the request carries, or null when it is absent or not one this service made. */
export function readDeviceMarker(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    if (part.slice(0, separator).trim() !== DEVICE_MARKER_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return MARKER_PATTERN.test(value) ? value : null;
  }
  return null;
}

/** Set-Cookie value that stores (or renews) the marker. */
export function deviceMarkerSetCookie(value: string): string {
  return `${DEVICE_MARKER_COOKIE}=${value}; Max-Age=${DEVICE_MARKER_MAX_AGE_SEC}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

/**
 * Hashes markers with a server key, so what a session record stores can neither be read back
 * into a marker nor be matched without the key.
 */
export class DeviceMarkerHasher {
  private readonly key: Buffer;

  /**
   * `secret` is the dedicated device-marker secret. Without one, the key is derived from the
   * issuer secret under a fixed label, so the two are never the same key.
   */
  constructor(input: { secret?: string | undefined; fallbackSecret: string }) {
    this.key = input.secret
      ? Buffer.from(input.secret, "utf8")
      : createHmac("sha256", input.fallbackSecret).update(KEY_LABEL).digest();
  }

  hash(marker: string): string {
    return createHmac("sha256", this.key).update(marker).digest("base64url");
  }
}
