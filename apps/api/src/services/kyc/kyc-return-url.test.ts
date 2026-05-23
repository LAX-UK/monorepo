import { describe, expect, it } from "vitest";
import { assertHttpsReturnUrl, normalizeKycReturnUrl } from "./kyc-return-url.js";

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

describe("assertHttpsReturnUrl", () => {
  it("accepts https URLs", () => {
    expect(() =>
      assertHttpsReturnUrl("https://test.lax.bid/dashboard/verify-identity"),
    ).not.toThrow();
  });

  it("rejects http URLs", () => {
    expect(() => assertHttpsReturnUrl("http://localhost:3000/dashboard")).toThrow(
      "kyc_return_url_must_be_https",
    );
  });
});
