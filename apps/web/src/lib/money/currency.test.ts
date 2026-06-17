import { describe, expect, it } from "vitest";
import {
  PLATFORM_DEFAULT_CURRENCY,
  formatEstimateRange,
  normalizeCurrencyCode,
  resolveLotCurrency,
} from "./currency";

describe("currency", () => {
  it("normalizes valid ISO codes", () => {
    expect(normalizeCurrencyCode("usd")).toBe("USD");
    expect(normalizeCurrencyCode("GBP")).toBe("GBP");
  });

  it("falls back to platform default for invalid codes", () => {
    expect(normalizeCurrencyCode(null)).toBe(PLATFORM_DEFAULT_CURRENCY);
    expect(normalizeCurrencyCode("")).toBe(PLATFORM_DEFAULT_CURRENCY);
    expect(normalizeCurrencyCode("US")).toBe(PLATFORM_DEFAULT_CURRENCY);
  });

  it("resolves lot currency from estimate metadata", () => {
    expect(
      resolveLotCurrency({
        marketingDetails: { estimate: { low: "100", high: "200", currency: "USD" } },
      }),
    ).toBe("USD");
    expect(resolveLotCurrency({ marketingDetails: {} })).toBe(PLATFORM_DEFAULT_CURRENCY);
  });

  it("formats estimate ranges with matching symbols", () => {
    expect(formatEstimateRange({ low: "400", high: "600", currency: "GBP" })).toMatch(/£400.*£600/);
    expect(formatEstimateRange({ low: "400", high: "600", currency: "USD" })).toMatch(
      /\$400.*\$600/,
    );
  });
});
