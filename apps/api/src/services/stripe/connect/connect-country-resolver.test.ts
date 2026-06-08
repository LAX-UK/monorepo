import { describe, expect, it } from "vitest";
import { resolveConnectAccountCountry } from "./connect-country-resolver.js";

describe("resolveConnectAccountCountry", () => {
  it("prefers entity address country over user address and KYC", () => {
    expect(
      resolveConnectAccountCountry({
        entityAddress: {
          line1: "1 High St",
          line2: null,
          city: "Paris",
          state: null,
          postalCode: "75001",
          country: "FR",
        },
        userAddress: {
          line1: "2 Main",
          line2: null,
          city: "London",
          state: null,
          postalCode: "SW1",
          country: "GB",
        },
        kycIdCountry: "US",
      }),
    ).toBe("FR");
  });

  it("falls back through user address and KYC to GB", () => {
    expect(
      resolveConnectAccountCountry({
        entityAddress: null,
        userAddress: {
          line1: "2 Main",
          line2: null,
          city: "Berlin",
          state: null,
          postalCode: "10115",
          country: "de",
        },
        kycIdCountry: null,
      }),
    ).toBe("DE");
  });

  it("defaults to GB when no valid country is available", () => {
    expect(
      resolveConnectAccountCountry({
        entityAddress: null,
        userAddress: null,
        kycIdCountry: "invalid",
      }),
    ).toBe("GB");
  });
});
