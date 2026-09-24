import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateOAuthLoginParams, validateOAuthStateTimingSafe } from "./pkce.js";

describe("identity-rp pkce", () => {
  it("creates independent state, nonce, and an S256 PKCE challenge", () => {
    const proof = generateOAuthLoginParams();
    expect(proof.state).not.toBe(proof.nonce);
    expect(proof.codeChallenge).toBe(
      createHash("sha256").update(proof.codeVerifier).digest("base64url"),
    );
  });

  it("accepts only the exact callback state with timing-safe compare", () => {
    expect(validateOAuthStateTimingSafe("expected-state", "expected-state")).toBe(true);
    expect(validateOAuthStateTimingSafe("expected-state", "attacker-state")).toBe(false);
    expect(validateOAuthStateTimingSafe("expected-state", null)).toBe(false);
  });
});
