import { describe, expect, it } from "vitest";
import { isIdTokenFresh } from "./token-expiry.js";

function idTokenWithExp(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds }), "utf8").toString("base64url");
  return `header.${payload}.signature`;
}

describe("isIdTokenFresh", () => {
  it("returns true when exp is beyond skew", () => {
    const now = 1_700_000_000_000;
    expect(isIdTokenFresh(idTokenWithExp(Math.floor(now / 1_000) + 120), now)).toBe(true);
  });

  it("returns false when exp is within skew", () => {
    const now = 1_700_000_000_000;
    expect(isIdTokenFresh(idTokenWithExp(Math.floor(now / 1_000) + 10), now)).toBe(false);
  });

  it("returns false for malformed tokens", () => {
    expect(isIdTokenFresh("not-a-jwt", Date.now())).toBe(false);
  });

  it("treats tokens issued before maxAgeMs as stale", () => {
    const now = 1_700_000_000_000;
    const nowSec = Math.floor(now / 1_000);
    const token = (iat?: number) =>
      `h.${Buffer.from(JSON.stringify({ exp: nowSec + 3600, iat }), "utf8").toString("base64url")}.s`;
    expect(isIdTokenFresh(token(nowSec - 30), now, undefined, 60_000)).toBe(true);
    expect(isIdTokenFresh(token(nowSec - 120), now, undefined, 60_000)).toBe(false);
    expect(isIdTokenFresh(token(), now, undefined, 60_000)).toBe(false);
    expect(isIdTokenFresh(token(nowSec - 120), now)).toBe(true);
  });
});
