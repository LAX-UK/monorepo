import { shouldSuppressKycBanner } from "@/components/dashboard/dashboard-banner-stack-client";
import { describe, expect, it } from "vitest";

describe("shouldSuppressKycBanner", () => {
  it("suppresses the KYC banner on the legacy verifier only", () => {
    expect(shouldSuppressKycBanner("/dashboard/verify-identity")).toBe(true);
    expect(shouldSuppressKycBanner("/dashboard/bids")).toBe(false);
    expect(shouldSuppressKycBanner("/dashboard/purchases")).toBe(false);
  });
});
