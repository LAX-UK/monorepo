import { describe, expect, it } from "vitest";
import { formatGbpPence, formatGbpPenceForDisplay } from "./shop-money.presenter.js";

describe("shop money presenter", () => {
  it("formats pence as en-GB pounds", () => {
    expect(formatGbpPence(85000)).toBe("£850.00");
    expect(formatGbpPence(1999)).toBe("£19.99");
  });

  it("drops the pence on display pages only when the price is whole pounds", () => {
    expect(formatGbpPenceForDisplay(34000)).toBe("£340");
    expect(formatGbpPenceForDisplay(125000)).toBe("£1,250");
    expect(formatGbpPenceForDisplay(9950)).toBe("£99.50");
  });
});
