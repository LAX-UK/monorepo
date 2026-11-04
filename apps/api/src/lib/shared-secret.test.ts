import { describe, expect, it } from "vitest";
import { sharedSecretMatches } from "./shared-secret.js";

describe("sharedSecretMatches", () => {
  const expected = "s3cret-value-0123456789-abcdefghij";

  it("accepts the exact secret", () => {
    expect(sharedSecretMatches(expected, expected)).toBe(true);
  });

  it("rejects a different secret of the same length", () => {
    expect(sharedSecretMatches(expected.replace("s3", "s4"), expected)).toBe(false);
  });

  it("rejects secrets of a different length without comparing bytes", () => {
    expect(sharedSecretMatches(`${expected}x`, expected)).toBe(false);
    expect(sharedSecretMatches(expected.slice(1), expected)).toBe(false);
  });

  it("rejects a missing header or a missing configured secret", () => {
    expect(sharedSecretMatches(undefined, expected)).toBe(false);
    expect(sharedSecretMatches("", expected)).toBe(false);
    expect(sharedSecretMatches("anything", "")).toBe(false);
  });
});
