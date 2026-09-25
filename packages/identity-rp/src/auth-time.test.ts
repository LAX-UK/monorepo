import { describe, expect, it } from "vitest";
import { assertRecentAuthentication } from "./auth-time.js";
import { IdentityRejectedError } from "./errors.js";

describe("assertRecentAuthentication", () => {
  const nowMs = 1_700_000_000_000;

  it("accepts auth_time within max_age", () => {
    expect(() =>
      assertRecentAuthentication({
        authTime: Math.floor(nowMs / 1000) - 30,
        maxAgeSeconds: 60,
        nowMs,
      }),
    ).not.toThrow();
  });

  it("rejects stale auth_time", () => {
    expect(() =>
      assertRecentAuthentication({
        authTime: Math.floor(nowMs / 1000) - 120,
        maxAgeSeconds: 60,
        nowMs,
      }),
    ).toThrow(IdentityRejectedError);
  });

  it("rejects missing auth_time", () => {
    expect(() =>
      assertRecentAuthentication({
        authTime: undefined,
        maxAgeSeconds: 60,
        nowMs,
      }),
    ).toThrow(/missing/i);
  });
});
