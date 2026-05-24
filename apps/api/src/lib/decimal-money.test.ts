import { describe, expect, it } from "vitest";
import { gbpAmountToPence } from "../lib/decimal-money.js";

describe("gbpAmountToPence", () => {
  it("converts major GBP units to integer pence", () => {
    expect(gbpAmountToPence("100.00")).toBe(10_000);
    expect(gbpAmountToPence("12.50")).toBe(1250);
  });
});
