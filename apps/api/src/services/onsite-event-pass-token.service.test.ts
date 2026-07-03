import type { OnsiteEventRsvp } from "@auction/types";
import { describe, expect, it } from "vitest";
import { OnsiteEventPassTokenService } from "./onsite-event-pass-token.service.js";

const TEST_SECRET = "test-secret-with-enough-length-for-scrypt";

const baseRsvp = (overrides: Partial<OnsiteEventRsvp> = {}): OnsiteEventRsvp => ({
  id: "rsvp-1",
  eventSlug: "lax001",
  userId: "user-1",
  attendanceSegment: "full_evening",
  plusOne: 0,
  plusOneGuestName: null,
  notes: null,
  checkInTokenHash: null,
  checkInTokenIssuedAt: null,
  checkInTokenCiphertext: null,
  checkedInAt: null,
  checkedInByUserId: null,
  checkInPartyCount: null,
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z"),
  ...overrides,
});

describe("OnsiteEventPassTokenService", () => {
  it("issueToken produces a matching plain/hash pair and versioned ciphertext", () => {
    const service = new OnsiteEventPassTokenService(TEST_SECRET);
    const token = service.issueToken();
    expect(token.plainToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.ciphertext).toMatch(/^v1:/);
    expect(service.decryptStoredToken(token.ciphertext)).toBe(token.plainToken);
  });

  it("resolveTokenForRsvp issues a new token when there is no existing RSVP", () => {
    const service = new OnsiteEventPassTokenService(TEST_SECRET);
    const token = service.resolveTokenForRsvp(null);
    expect(token.plainToken).toBeTruthy();
    expect(service.decryptStoredToken(token.ciphertext)).toBe(token.plainToken);
  });

  it("resolveTokenForRsvp reuses the existing token when it still decrypts", () => {
    const service = new OnsiteEventPassTokenService(TEST_SECRET);
    const issued = service.issueToken();
    const existing = baseRsvp({
      checkInTokenHash: issued.tokenHash,
      checkInTokenIssuedAt: issued.issuedAt,
      checkInTokenCiphertext: issued.ciphertext,
    });

    const resolved = service.resolveTokenForRsvp(existing);

    expect(resolved.plainToken).toBe(issued.plainToken);
    expect(resolved.tokenHash).toBe(issued.tokenHash);
    expect(resolved.ciphertext).toBe(issued.ciphertext);
  });

  it("resolveTokenForRsvp reissues when the stored ciphertext can't be decrypted (e.g. secret rotated)", () => {
    const original = new OnsiteEventPassTokenService(TEST_SECRET);
    const issued = original.issueToken();
    const existing = baseRsvp({
      checkInTokenHash: issued.tokenHash,
      checkInTokenIssuedAt: issued.issuedAt,
      checkInTokenCiphertext: issued.ciphertext,
    });

    const rotatedSecretService = new OnsiteEventPassTokenService("a-completely-different-secret");
    const resolved = rotatedSecretService.resolveTokenForRsvp(existing);

    expect(resolved.plainToken).not.toBe(issued.plainToken);
  });

  it("decryptStoredToken returns null for null ciphertext or missing secret", () => {
    expect(new OnsiteEventPassTokenService(TEST_SECRET).decryptStoredToken(null)).toBeNull();
    const issued = new OnsiteEventPassTokenService(TEST_SECRET).issueToken();
    expect(new OnsiteEventPassTokenService(null).decryptStoredToken(issued.ciphertext)).toBeNull();
  });

  it("issueToken throws when no cipher secret is configured", () => {
    const service = new OnsiteEventPassTokenService(null);
    expect(() => service.issueToken()).toThrow(/encryption secret is not configured/);
  });
});
