import { describe, expect, it } from "vitest";
import { formatMoneyMajor } from "./format-money.js";

describe("formatMoneyMajor", () => {
  it("formats a major-unit amount in the platform currency", () => {
    expect(formatMoneyMajor("1250.00")).toBe("£1,250.00");
    expect(formatMoneyMajor("420")).toBe("£420.00");
  });

  it("uses the given currency and falls back for an invalid code", () => {
    expect(formatMoneyMajor("10.5", "EUR")).toBe("€10.50");
    expect(formatMoneyMajor("10.5", "pounds")).toBe("£10.50");
  });

  it("returns null when there is no usable amount", () => {
    expect(formatMoneyMajor(undefined)).toBeNull();
    expect(formatMoneyMajor("")).toBeNull();
    expect(formatMoneyMajor("Another bidder placed a higher bid")).toBeNull();
  });
});
