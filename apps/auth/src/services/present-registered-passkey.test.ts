import { describe, expect, it } from "vitest";
import { presentRegisteredPasskey } from "./present-registered-passkey.js";

const ICLOUD_AAGUID = "fbfc3007-154e-4ecc-8c0b-6e020557d7bd";

describe("presentRegisteredPasskey", () => {
  it("carries the aaguid of the just-registered record into the provider", () => {
    const passkey = presentRegisteredPasskey({
      id: "pk-1",
      name: "Laptop",
      deviceType: "multiDevice",
      backedUp: true,
      transports: "internal",
      aaguid: ICLOUD_AAGUID,
      createdAt: "2026-11-03T12:00:00.000Z",
    });
    expect(passkey?.provider).toBe("apple");
  });

  it("falls back to unknown when the record has no aaguid", () => {
    const passkey = presentRegisteredPasskey({
      id: "pk-2",
      name: "Laptop",
      deviceType: "multiDevice",
      backedUp: true,
      createdAt: "2026-11-03T12:00:00.000Z",
    });
    expect(passkey?.provider).toBe("unknown");
  });

  it("returns null for a record that is not a passkey", () => {
    expect(presentRegisteredPasskey(null)).toBeNull();
  });
});
