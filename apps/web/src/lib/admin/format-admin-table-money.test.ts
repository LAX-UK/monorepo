import { describe, expect, it } from "vitest";
import { formatAdminTableMoney, formatAdminTableMoneyRange } from "./format-admin-table-money";

describe("formatAdminTableMoney", () => {
  it("formats GBP with symbol", () => {
    expect(formatAdminTableMoney("1250", "GBP").primary).toMatch(/£1,250/);
  });

  it("returns em dash for null/blank", () => {
    expect(formatAdminTableMoney(null).primary).toBe("—");
    expect(formatAdminTableMoney("").primary).toBe("—");
    expect(formatAdminTableMoney("  ").primary).toBe("—");
  });

  it("treats zero as empty when requested", () => {
    expect(formatAdminTableMoney("0", "GBP", { treatZeroAsEmpty: true }).primary).toBe("—");
    expect(formatAdminTableMoney(0, "GBP", { treatZeroAsEmpty: true }).primary).toBe("—");
  });

  it("keeps zero when treatZeroAsEmpty is false", () => {
    expect(formatAdminTableMoney("0", "GBP").primary).toMatch(/£0/);
  });
});

describe("formatAdminTableMoneyRange", () => {
  it("formats estimate range", () => {
    const display = formatAdminTableMoneyRange("1000", "2000", "GBP");
    expect(display.primary).toMatch(/£1,000/);
    expect(display.primary).toMatch(/£2,000/);
  });

  it("returns em dash when range is incomplete", () => {
    expect(formatAdminTableMoneyRange("", "2000", "GBP").primary).toBe("—");
    expect(formatAdminTableMoneyRange("1000", null, "GBP").primary).toBe("—");
  });
});
