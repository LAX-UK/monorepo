import { describe, expect, it } from "vitest";
import { hasSessionCredential } from "./session-credential.js";

describe("hasSessionCredential", () => {
  it("detects Better Auth session cookie", () => {
    const headers = new Headers({
      cookie: "better-auth.session_token=abc123",
    });
    expect(hasSessionCredential(headers)).toBe(true);
  });

  it("detects Bearer authorization", () => {
    const headers = new Headers({ authorization: "Bearer token" });
    expect(hasSessionCredential(headers)).toBe(true);
  });

  it("returns false for anonymous requests", () => {
    expect(hasSessionCredential(new Headers())).toBe(false);
  });
});
