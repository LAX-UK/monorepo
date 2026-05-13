import { describe, expect, it } from "vitest";
import { extractBetterAuthSessionToken } from "./session-cookie.js";

/** Hono-style base64 signature segment (44 chars, ends with `=`). */
const fakeSig = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

describe("extractBetterAuthSessionToken", () => {
  it("returns raw token when cookie is unsigned (legacy)", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    const header = `better-auth.session_token=${token}`;
    expect(extractBetterAuthSessionToken(header)).toBe(token);
  });

  it("strips Hono signed-cookie suffix before DB lookup", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    const signed = `${token}.${fakeSig}`;
    const header = `better-auth.session_token=${signed}`;
    expect(extractBetterAuthSessionToken(header)).toBe(token);
  });

  it("handles URL-encoded signed cookie value", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    const signed = `${token}.${fakeSig}`;
    const header = `better-auth.session_token=${encodeURIComponent(signed)}`;
    expect(extractBetterAuthSessionToken(header)).toBe(token);
  });

  it("prefers __Secure- prefix when both appear (first wins per regex order)", () => {
    const secureToken = "SecureToken01234567890123456789012";
    const plainToken = "PlainToken01234567890123456789012";
    const header = `foo=1; __Secure-better-auth.session_token=${secureToken}.${fakeSig}; better-auth.session_token=${plainToken}`;
    expect(extractBetterAuthSessionToken(header)).toBe(secureToken);
  });

  it("falls back to better-auth.session_token without __Secure-", () => {
    const token = "PlainToken01234567890123456789012";
    const header = `other=value; better-auth.session_token=${token}.${fakeSig}`;
    expect(extractBetterAuthSessionToken(header)).toBe(token);
  });

  it("returns null when session cookie absent", () => {
    expect(extractBetterAuthSessionToken(undefined)).toBeNull();
    expect(extractBetterAuthSessionToken("")).toBeNull();
    expect(extractBetterAuthSessionToken("sessionid=abc")).toBeNull();
  });

  it("does not strip a dot that is not a Hono signature (wrong length)", () => {
    const raw = "part1.part2.part3";
    const header = `better-auth.session_token=${raw}`;
    expect(extractBetterAuthSessionToken(header)).toBe(raw);
  });
});
