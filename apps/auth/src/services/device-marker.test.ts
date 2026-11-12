import { describe, expect, it } from "vitest";
import {
  DEVICE_MARKER_COOKIE,
  DEVICE_MARKER_MAX_AGE_SEC,
  DeviceMarkerHasher,
  deviceMarkerSetCookie,
  mintDeviceMarker,
  readDeviceMarker,
} from "./device-marker.js";

describe("device marker", () => {
  it("is 128 random bits, different every time", () => {
    const markers = new Set(Array.from({ length: 50 }, () => mintDeviceMarker()));
    expect(markers.size).toBe(50);
    for (const marker of markers) {
      expect(marker).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(Buffer.from(marker, "base64url")).toHaveLength(16);
    }
  });

  it("is set host-only, HttpOnly, Secure, Lax, for 400 days", () => {
    const cookie = deviceMarkerSetCookie("abcdefghijklmnopqrstuv");
    expect(cookie).toBe(
      `${DEVICE_MARKER_COOKIE}=abcdefghijklmnopqrstuv; Max-Age=34560000; Path=/; Secure; HttpOnly; SameSite=Lax`,
    );
    expect(DEVICE_MARKER_MAX_AGE_SEC).toBe(400 * 24 * 60 * 60);
    // The __Host- prefix forbids a Domain attribute, which keeps it on the issuer's own host.
    expect(cookie).not.toMatch(/Domain=/i);
    expect(DEVICE_MARKER_COOKIE.startsWith("__Host-")).toBe(true);
  });

  it("reads the marker from a cookie header and ignores anything it did not make", () => {
    const marker = mintDeviceMarker();
    expect(readDeviceMarker(`a=1; ${DEVICE_MARKER_COOKIE}=${marker}; b=2`)).toBe(marker);
    expect(readDeviceMarker(null)).toBeNull();
    expect(readDeviceMarker("a=1")).toBeNull();
    expect(readDeviceMarker(`${DEVICE_MARKER_COOKIE}=short`)).toBeNull();
    expect(readDeviceMarker(`${DEVICE_MARKER_COOKIE}=${"x".repeat(60)}`)).toBeNull();
    expect(readDeviceMarker(`lax_device=${marker}`)).toBeNull();
  });
});

describe("DeviceMarkerHasher", () => {
  const marker = "abcdefghijklmnopqrstuv";

  it("stores a keyed hash, never the marker", () => {
    const hasher = new DeviceMarkerHasher({
      secret: "k".repeat(32),
      fallbackSecret: "f".repeat(32),
    });
    const hash = hasher.hash(marker);
    expect(hash).not.toContain(marker);
    expect(hash).toBe(hasher.hash(marker));
    expect(hash).not.toBe(hasher.hash(`${marker.slice(0, -1)}w`));
  });

  it("depends on the key, so a leaked table cannot be matched without it", () => {
    const one = new DeviceMarkerHasher({ secret: "a".repeat(32), fallbackSecret: "f".repeat(32) });
    const two = new DeviceMarkerHasher({ secret: "b".repeat(32), fallbackSecret: "f".repeat(32) });
    expect(one.hash(marker)).not.toBe(two.hash(marker));
  });

  it("derives its key from the issuer secret when none is set, and not as the same key", () => {
    const derived = new DeviceMarkerHasher({ fallbackSecret: "issuer-secret-0123456789" });
    const asKey = new DeviceMarkerHasher({
      secret: "issuer-secret-0123456789",
      fallbackSecret: "other",
    });
    expect(derived.hash(marker)).toBe(
      new DeviceMarkerHasher({ fallbackSecret: "issuer-secret-0123456789" }).hash(marker),
    );
    expect(derived.hash(marker)).not.toBe(asKey.hash(marker));
  });
});
