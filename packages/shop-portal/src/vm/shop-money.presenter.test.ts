import { describe, expect, it } from "vitest";
import { formatGbpPence } from "./shop-money.presenter.js";

describe("shop money presenter", () => {
  it("formats pence as en-GB pounds", () => {
    expect(formatGbpPence(85000)).toBe("£850.00");
    expect(formatGbpPence(1999)).toBe("£19.99");
  });
});
