import { describe, expect, it } from "vitest";
import { formatSaleroomMoney } from "./format-saleroom-money";

describe("formatSaleroomMoney", () => {
  it("writes pounds with pence and thousands separators", () => {
    expect(formatSaleroomMoney("1250.5")).toBe("£1,250.50");
    expect(formatSaleroomMoney(100)).toBe("£100.00");
  });

  it("names a currency other than pounds", () => {
    expect(formatSaleroomMoney("100.00", "EUR")).toBe("€100.00 EUR");
  });

  it("shows a dash for anything that is not an amount", () => {
    expect(formatSaleroomMoney(null)).toBe("—");
    expect(formatSaleroomMoney("")).toBe("—");
    expect(formatSaleroomMoney("undefined")).toBe("—");
  });
});
