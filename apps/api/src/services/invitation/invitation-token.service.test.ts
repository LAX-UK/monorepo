import { describe, expect, it } from "vitest";
import { InvitationTokenService } from "./invitation-token.service.js";

describe("InvitationTokenService", () => {
  const service = new InvitationTokenService();

  it("normalizes email to lowercase trimmed", () => {
    expect(service.normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("hashes tokens deterministically", () => {
    expect(service.hashToken("abc")).toBe(service.hashToken("abc"));
    expect(service.hashToken("abc")).not.toBe(service.hashToken("def"));
  });

  it("generates unique raw tokens with matching hash", () => {
    const first = service.generateToken();
    const second = service.generateToken();
    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.tokenHash).toBe(service.hashToken(first.rawToken));
    expect(second.tokenHash).toBe(service.hashToken(second.rawToken));
  });

  it("adds days in UTC", () => {
    const base = new Date("2026-01-01T12:00:00.000Z");
    const result = service.addDays(base, 7);
    expect(result.toISOString()).toBe("2026-01-08T12:00:00.000Z");
  });
});
