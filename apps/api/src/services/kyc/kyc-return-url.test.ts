import { describe, expect, it } from "vitest";
import { assertKycReturnUrlAllowed, normalizeKycReturnUrl } from "./kyc-return-url.js";

describe("normalizeKycReturnUrl", () => {
  it("rewrites http localhost using WEB_ORIGIN", () => {
    expect(
      normalizeKycReturnUrl(
        "http://localhost:3000/dashboard/verify-identity?kyc=complete",
        "https://test.lax.bid",
      ),
    ).toBe("https://test.lax.bid/dashboard/verify-identity?kyc=complete");
  });

  it("leaves https URLs unchanged", () => {
    const url = "https://test.lax.bid/dashboard/verify-identity?kyc=complete";
    expect(normalizeKycReturnUrl(url, "https://test.lax.bid")).toBe(url);
  });
});

describe("assertKycReturnUrlAllowed", () => {
  it("accepts HTTPS URLs on the trusted web origin", () => {
    expect(() =>
      assertKycReturnUrlAllowed(
        "https://test.lax.bid/dashboard/verify-identity",
        "https://test.lax.bid",
      ),
    ).not.toThrow();
  });

  it("rejects http URLs", () => {
    expect(() =>
      assertKycReturnUrlAllowed("http://localhost:3000/dashboard", "http://localhost:3000"),
    ).toThrow("kyc_return_url_must_be_https");
  });

  it("rejects HTTPS URLs on an untrusted origin", () => {
    expect(() =>
      assertKycReturnUrlAllowed("https://evil.example/phish", "https://test.lax.bid"),
    ).toThrow("kyc_return_url_origin_not_allowed");
  });
});
