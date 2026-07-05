import { describe, expect, it } from "vitest";
import { settleProxyPrice } from "./bid-money.js";

describe("settleProxyPrice", () => {
  it("settles large ceiling gap in one step (5001 when max 10000 vs 5000)", () => {
    const price = settleProxyPrice({
      winnerCeiling: "10000.00",
      runnerUpCeiling: "5000.00",
      winnerStep: "1.00",
      currentPrice: "150.00",
    });
    expect(price).toBe("5001.00");
  });

  it("returns null when there is no competing proxy", () => {
    const price = settleProxyPrice({
      winnerCeiling: "500.00",
      runnerUpCeiling: null,
      winnerStep: "10.00",
      currentPrice: "110.00",
    });
    expect(price).toBeNull();
  });

  it("uses winner step above runner-up ceiling", () => {
    const price = settleProxyPrice({
      winnerCeiling: "500.00",
      runnerUpCeiling: "300.00",
      winnerStep: "10.00",
      currentPrice: "110.00",
    });
    expect(price).toBe("310.00");
  });
});
