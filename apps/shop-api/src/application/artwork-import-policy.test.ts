import { describe, expect, it } from "vitest";
import { assertArtworkImportIdentityUnchanged } from "./artwork-import-policy.js";

describe("artwork import identity policy", () => {
  const existing = {
    slug: "stable-slug",
    eligibleForEditionAllocation: true,
  };

  it("allows mutable metadata updates when identity is unchanged", () => {
    expect(() => assertArtworkImportIdentityUnchanged(existing, existing)).not.toThrow();
  });

  it("rejects edition eligibility and slug changes", () => {
    expect(() =>
      assertArtworkImportIdentityUnchanged(existing, {
        ...existing,
        eligibleForEditionAllocation: false,
      }),
    ).toThrow(/eligibility is immutable/);
    expect(() =>
      assertArtworkImportIdentityUnchanged(existing, {
        ...existing,
        slug: "changed-slug",
      }),
    ).toThrow(/slug is immutable/);
  });
});
