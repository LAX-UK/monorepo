import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createLoginProof, validateCallbackState } from "./oidc.server";

describe("Bid BFF OIDC login binding", () => {
  it("creates independent state, nonce, and an S256 PKCE challenge", () => {
    const proof = createLoginProof();
    expect(proof.state).not.toBe(proof.nonce);
    expect(proof.codeChallenge).toBe(
      createHash("sha256").update(proof.codeVerifier).digest("base64url"),
    );
  });

  it("accepts only the exact callback state", () => {
    expect(validateCallbackState("expected-state", "expected-state")).toBe(true);
    expect(validateCallbackState("expected-state", "attacker-state")).toBe(false);
    expect(validateCallbackState("expected-state", null)).toBe(false);
  });
});
