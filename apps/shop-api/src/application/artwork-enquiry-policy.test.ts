import { describe, expect, it } from "vitest";
import { isArtworkEligibleForEnquiry } from "./artwork-enquiry-policy.js";

describe("isArtworkEligibleForEnquiry", () => {
  it("allows enquiry only for price-on-application originals", () => {
    expect(
      isArtworkEligibleForEnquiry({
        eligibleForEditionAllocation: false,
        saleState: "price_on_application",
      }),
    ).toBe(true);
    expect(
      isArtworkEligibleForEnquiry({
        eligibleForEditionAllocation: false,
        saleState: "sold",
      }),
    ).toBe(false);
    expect(
      isArtworkEligibleForEnquiry({
        eligibleForEditionAllocation: true,
        saleState: "price_on_application",
      }),
    ).toBe(false);
  });
});
