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
});
