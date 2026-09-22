import { describe, expect, it } from "vitest";
import { createTokenCipher } from "./token-crypto.js";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("createTokenCipher", () => {
  it("round-trips plaintext", () => {
    const cipher = createTokenCipher(KEY);
    const sealed = cipher.seal("refresh-token-secret");
    expect(cipher.open(sealed)).toBe("refresh-token-secret");
  });

  it("returns null for tampered ciphertext", () => {
    const cipher = createTokenCipher(KEY);
    const sealed = cipher.seal("token");
    expect(cipher.open(`${sealed}x`)).toBeNull();
  });
});
