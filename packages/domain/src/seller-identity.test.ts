import { legalEntityStatuses, userKycStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { sellerIdentityVerified } from "./seller-identity.js";

describe("sellerIdentityVerified", () => {
  it("accepts a person only once their identity verification is approved", () => {
    for (const kycStatus of [...userKycStatuses, null]) {
      expect(sellerIdentityVerified({ kind: "individual", kycStatus })).toBe(
        kycStatus === "approved",
      );
    }
  });

  it("accepts an organisation once LAX approved its documents", () => {
    for (const status of legalEntityStatuses) {
      expect(sellerIdentityVerified({ kind: "organisation", status })).toBe(
        status === "approved" || status === "restricted",
      );
    }
  });
});
