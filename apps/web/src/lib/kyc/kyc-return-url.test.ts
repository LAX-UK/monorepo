import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site-url", () => ({
  getSiteUrl: () => "https://test.lax.bid",
}));

import { normalizeKycReturnUrl } from "./kyc-return-url";

describe("normalizeKycReturnUrl", () => {
  it("prefixes relative paths with site origin", () => {
    expect(normalizeKycReturnUrl("/dashboard/seller/connect")).toBe(
      "https://test.lax.bid/dashboard/seller/connect",
    );
  });

  it("preserves query strings on relative paths", () => {
    expect(normalizeKycReturnUrl("/dashboard/verify-identity?kyc=complete&next=%2Ffoo")).toBe(
      "https://test.lax.bid/dashboard/verify-identity?kyc=complete&next=%2Ffoo",
    );
  });

  it("passes through absolute urls", () => {
    expect(normalizeKycReturnUrl("https://example.com/callback")).toBe(
      "https://example.com/callback",
    );
  });
});
