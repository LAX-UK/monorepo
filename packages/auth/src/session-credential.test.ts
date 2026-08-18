import { describe, expect, it } from "vitest";
import { hasSessionCredential } from "./session-credential.js";

describe("hasSessionCredential", () => {
  it("rejects product-server cookie credentials", () => {
    const headers = new Headers({
      cookie: "identity.session_token=abc123",
    });
    expect(hasSessionCredential(headers)).toBe(false);
  });

  it("detects Bearer authorization", () => {
    const headers = new Headers({ authorization: "Bearer token" });
    expect(hasSessionCredential(headers)).toBe(true);
  });

  it("returns false for anonymous requests", () => {
    expect(hasSessionCredential(new Headers())).toBe(false);
  });
});
