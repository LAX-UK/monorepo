import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { computeNewPaymentTerms } from "./create-pending-for-winner.pipeline.js";

const lot = {
  id: "lot-1",
  saleId: "sale-1",
  buyerLegalEntityId: "le-buyer",
  sellerLegalEntityId: "le-seller",
  currentPrice: "1000.00",
  buyerPremiumRate: "0.25",
} as Lot;

describe("computeNewPaymentTerms", () => {
  it("a sale that cannot be read is a typed 503, never a total on the wrong rate", async () => {
    const result = await computeNewPaymentTerms(
      {
        payments: { findRefundedByLotAndBuyerAccount: vi.fn().mockResolvedValue(null) },
        sales: { findById: vi.fn().mockRejectedValue(new Error("db down")) },
      } as never,
      lot,
      "buyer-1",
    );
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 503, code: "pricing_unavailable" });
  });
});
