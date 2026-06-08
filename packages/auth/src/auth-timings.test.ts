import { describe, expect, it } from "vitest";
import { AUTH_TIMINGS } from "./auth-timings.js";

describe("AUTH_TIMINGS", () => {
  it("pins verification, reset, OIDC refresh, and session windows used by Better Auth config", () => {
    expect(AUTH_TIMINGS.emailVerificationExpiresSec).toBe(60 * 60 * 24);
    expect(AUTH_TIMINGS.resetPasswordExpiresSec).toBe(60 * 60);
    expect(AUTH_TIMINGS.magicLinkExpiresSec).toBe(15 * 60);
    expect(AUTH_TIMINGS.oidcRefreshTokenExpiresSec).toBe(60 * 60 * 24 * 30);
    expect(AUTH_TIMINGS.sessionExpiresSec).toBe(60 * 60 * 24 * 7);
    expect(AUTH_TIMINGS.sessionUpdateAgeSec).toBe(60 * 60 * 24);
    expect(AUTH_TIMINGS.recentPasswordProofMaxAgeSec).toBe(10 * 60);
  });
});
