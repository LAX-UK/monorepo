import { describe, expect, it } from "vitest";
import { formatMoney } from "./format-currency";

describe("format-currency", () => {
  it("formats amounts in GBP", () => {
    expect(formatMoney(1234.5)).toMatch(/£1,234\.50/);
  });

  it("returns raw string for non-numeric input", () => {
    expect(formatMoney("TBC")).toBe("TBC");
  });

  it("does not surface undefined coercions from bad wire values", () => {
    expect(formatMoney("undefined")).toBe("—");
  });
});
