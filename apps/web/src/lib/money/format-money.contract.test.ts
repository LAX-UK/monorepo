import { formatMoney } from "@/lib/ui/format";
import { describe, expect, it } from "vitest";

describe("formatMoney contract", () => {
  it("formats GBP with pound symbol", () => {
    expect(formatMoney("100", "GBP")).toMatch(/£100/);
  });

  it("formats USD with dollar symbol", () => {
    expect(formatMoney("100", "USD")).toMatch(/\$100/);
  });

  it("defaults to platform GBP", () => {
    expect(formatMoney("100")).toMatch(/£100/);
    expect(formatMoney("100")).not.toMatch(/\$/);
  });
});
