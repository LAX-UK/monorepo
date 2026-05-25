import { describe, expect, it } from "vitest";
import { hasAuthSessionCookie } from "./session-cookie";

describe("hasAuthSessionCookie", () => {
  it("returns false for empty header", () => {
    expect(hasAuthSessionCookie(null)).toBe(false);
    expect(hasAuthSessionCookie("")).toBe(false);
  });

  it("detects Better Auth session cookies", () => {
    expect(hasAuthSessionCookie("better-auth.session_token=abc")).toBe(true);
    expect(hasAuthSessionCookie("__Secure-better-auth.session_token=abc")).toBe(true);
    expect(hasAuthSessionCookie("session_token=legacy")).toBe(true);
  });

  it("returns false when no session cookie is present", () => {
    expect(hasAuthSessionCookie("lax_theme=dark; consent=1")).toBe(false);
  });
});
