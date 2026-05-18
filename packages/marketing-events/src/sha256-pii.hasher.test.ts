import { describe, expect, it } from "vitest";
import { Sha256PiiHasher } from "./sha256-pii.hasher.js";

describe("Sha256PiiHasher", () => {
  const hasher = new Sha256PiiHasher();

  it("normalizes gmail addresses before hashing", () => {
    const a = hasher.hashEmail("Test.User+tag@gmail.com");
    const b = hasher.hashEmail("testuser@gmail.com");
    expect(a).toBe(b);
  });

  it("hashes external ids deterministically", () => {
    expect(hasher.hashExternalId(" user-1 ")).toBe(hasher.hashExternalId("user-1"));
  });
});
