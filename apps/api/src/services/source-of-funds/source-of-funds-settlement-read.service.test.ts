import { describe, expect, it } from "vitest";
import {
  type SourceOfFundsSettlementItem,
  buildSettlementSummaryLabel,
} from "./source-of-funds-settlement-read.service.js";

describe("buildSettlementSummaryLabel", () => {
  it("returns null for empty items", () => {
    expect(buildSettlementSummaryLabel([])).toEqual({
      settlementSummary: null,
      settlementItemCount: 0,
    });
  });

  it("formats top item with lot number and sale title", () => {
    const items: SourceOfFundsSettlementItem[] = [
      {
        kind: "payment",
        lotId: "lot-1",
        lotTitle: "Rolex Submariner",
        lotNumber: 42,
        saleId: "sale-1",
        saleTitle: "Summer Sale",
        amountPence: 500_000,
        paymentId: "pay-1",
        paymentStatus: "pending",
      },
    ];
    expect(buildSettlementSummaryLabel(items)).toEqual({
      settlementSummary: "Lot 42 · Summer Sale",
      settlementItemCount: 1,
    });
  });

  it("appends (+N more) when multiple items", () => {
    const items: SourceOfFundsSettlementItem[] = [
      {
        kind: "payment",
        lotId: "lot-1",
        lotTitle: "A",
        lotNumber: 1,
        saleId: "s1",
        saleTitle: "Sale A",
        amountPence: 100,
      },
      {
        kind: "won_unpaid",
        lotId: "lot-2",
        lotTitle: "B",
        lotNumber: 2,
        saleId: "s2",
        saleTitle: "Sale B",
        amountPence: 50,
      },
    ];
    expect(buildSettlementSummaryLabel(items).settlementSummary).toBe("Lot 1 · Sale A (+1 more)");
    expect(buildSettlementSummaryLabel(items).settlementItemCount).toBe(2);
  });
});
