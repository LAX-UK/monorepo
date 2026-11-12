import { saleLineBreakdown } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { sellerNetForSale } from "./seller-net.js";

const policy = (bps: number) => ({
  computePlatformFeeFromPence: async (_seller: string, pence: number) =>
    (Math.round((pence * bps) / 10_000) / 100).toFixed(2),
});

describe("sellerNetForSale", () => {
  it("is the buyer's total less the platform fee on it", async () => {
    expect(await sellerNetForSale(policy(500), "s", 10_250_000)).toEqual({
      salePence: 10_250_000,
      feesPence: 512_500,
      netPence: 9_737_500,
    });
  });

  it.each([1, 99, 12_345, 10_250_001, 987_654_321])(
    "matches the split Sold & payouts shows for a total of %i pence",
    async (total) => {
      const net = await sellerNetForSale(policy(1_250), "s", total);
      const amount = (total / 100).toFixed(2);
      const fee = await policy(1_250).computePlatformFeeFromPence("s", total);
      const split = saleLineBreakdown({
        lineAmount: amount,
        paymentAmount: amount,
        platformFee: fee,
      });
      expect((net.netPence / 100).toFixed(2)).toBe(split.net);
      expect(net.salePence - net.feesPence).toBe(net.netPence);
    },
  );
});
