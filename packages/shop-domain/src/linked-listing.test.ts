import { describe, expect, it } from "vitest";
import {
  assertCorrectionReason,
  assertProofListingApproved,
  defaultProofOwner,
  proofListingSlug,
  proofListingTitle,
} from "./linked-listing.js";

describe("proof listings", () => {
  it("gives artist's proofs to the artist and printer's and hors commerce proofs to LAX", () => {
    expect(defaultProofOwner("ap")).toBe("artist");
    expect(defaultProofOwner("pp")).toBe("lax");
    expect(defaultProofOwner("hc")).toBe("lax");
  });

  it("names the listing after its main run", () => {
    expect(proofListingTitle("Harbour at dusk ", "ap")).toBe("Harbour at dusk (artist's proof)");
    expect(proofListingTitle("Harbour at dusk", "pp")).toBe("Harbour at dusk (printer's proof)");
    expect(proofListingSlug("harbour-at-dusk", "hc")).toBe("harbour-at-dusk-hors-commerce-proof");
  });

  it("lists hors commerce proofs only with a shop admin's approval", () => {
    expect(() =>
      assertProofListingApproved({ proofType: "hc", approvedByShopAdmin: false }),
    ).toThrow("only with a shop admin's approval");
    expect(() =>
      assertProofListingApproved({ proofType: "hc", approvedByShopAdmin: true }),
    ).not.toThrow();
    expect(() =>
      assertProofListingApproved({ proofType: "ap", approvedByShopAdmin: false }),
    ).not.toThrow();
  });
});

describe("assertCorrectionReason", () => {
  it("needs a reason, trimmed, within the limit", () => {
    expect(() => assertCorrectionReason("  ")).toThrow("Say why");
    expect(() => assertCorrectionReason(undefined)).toThrow("Say why");
    expect(() => assertCorrectionReason("x".repeat(501))).toThrow("500 characters");
    expect(assertCorrectionReason(" Signed on the back, not the front ")).toBe(
      "Signed on the back, not the front",
    );
  });
});
