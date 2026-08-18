import { describe, expect, it } from "vitest";
import { hasAuthSessionCookie } from "./session-cookie";

describe("hasAuthSessionCookie", () => {
  it("returns false for empty header", () => {
    expect(hasAuthSessionCookie(null)).toBe(false);
    expect(hasAuthSessionCookie("")).toBe(false);
  });

  it("detects development and production Bid BFF cookies", () => {
    expect(hasAuthSessionCookie("lax-bid-session=abc")).toBe(true);
    expect(hasAuthSessionCookie("__Host-lax-bid-session=abc")).toBe(true);
    expect(hasAuthSessionCookie("other=x; __Host-lax-bid-session=abc")).toBe(true);
  });

  it("ignores Identity issuer cookies", () => {
    expect(hasAuthSessionCookie("better-auth.session_token=abc")).toBe(false);
    expect(hasAuthSessionCookie("__Secure-better-auth.session_token=abc")).toBe(false);
    expect(hasAuthSessionCookie("better-auth.session_data=abc")).toBe(false);
    expect(hasAuthSessionCookie("better-auth.dont_remember=1")).toBe(false);
    expect(hasAuthSessionCookie("session_token=legacy")).toBe(false);
  });

  it("returns false when no session cookie is present", () => {
    expect(hasAuthSessionCookie("lax_theme=dark; consent=1")).toBe(false);
  });
});
