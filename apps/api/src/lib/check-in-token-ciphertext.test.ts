import { describe, expect, it } from "vitest";
import { decryptCheckInToken, encryptCheckInToken } from "./check-in-token-ciphertext.js";

describe("check-in-token-ciphertext", () => {
  const secret = "test-secret-with-enough-length-for-scrypt";

  it("round-trips a token", () => {
    const plain = "abc123XYZ_token-value";
    const ciphertext = encryptCheckInToken(plain, secret);
    expect(decryptCheckInToken(ciphertext, secret)).toBe(plain);
  });

  it("returns null for tampered ciphertext", () => {
    const ciphertext = encryptCheckInToken("token", secret);
    expect(decryptCheckInToken(`${ciphertext}x`, secret)).toBeNull();
  });
});
