import { describe, expect, it } from "vitest";
import { gbpAmountToPence, gbpPenceToMajorString } from "./decimal-money.js";

describe("gbpPenceToMajorString", () => {
  it("formats integer pence to two decimal major units", () => {
    expect(gbpPenceToMajorString(12_345)).toBe("123.45");
    expect(gbpPenceToMajorString(1)).toBe("0.01");
    expect(gbpPenceToMajorString(0)).toBe("0.00");
  });

  it("round-trips with gbpAmountToPence for typical checkout amounts", () => {
    const samples = ["100.00", "499999.99", "574999.99", "1000000.00"];
    for (const major of samples) {
      expect(gbpPenceToMajorString(gbpAmountToPence(major))).toBe(major);
    }
  });
});
