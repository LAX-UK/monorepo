import { describe, expect, it } from "vitest";
import { normalizeCurrencyInput } from "./submission-currency";

describe("normalizeCurrencyInput", () => {
  it("strips currency symbols and grouping separators", () => {
    expect(normalizeCurrencyInput("£1,200.50")).toBe("1200.50");
    expect(normalizeCurrencyInput("$ 2,500")).toBe("2500");
    expect(normalizeCurrencyInput("10,50")).toBe("10.50");
  });

  it("handles spaces and non-breaking spaces", () => {
    expect(normalizeCurrencyInput("  1 200  ")).toBe("1200");
    expect(normalizeCurrencyInput("1\u00a0200")).toBe("1200");
  });

  it("drops a trailing decimal point", () => {
    expect(normalizeCurrencyInput("99.")).toBe("99");
  });

  it("returns empty for blank input", () => {
    expect(normalizeCurrencyInput("")).toBe("");
    expect(normalizeCurrencyInput("   ")).toBe("");
  });
});
