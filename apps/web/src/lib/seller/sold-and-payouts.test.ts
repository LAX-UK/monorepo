import type { Lot, Payout } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildPayoutDestination, buildPayoutRows, buildSoldWorks } from "./sold-and-payouts.vm";

function lot(id: string, overrides: Partial<Lot>): Lot {
  return {
    id,
    saleId: "sale-1",
    lotNumber: 3,
    title: `Work ${id}`,
    images: [],
    currentPrice: "3800",
    status: "ended",
    winnerId: "buyer",
    endTime: new Date("2026-06-19T18:00:00Z"),
    marketingDetails: {},
    ...overrides,
  } as Lot;
}

describe("buildSoldWorks", () => {
  it("lists only sold lots, newest first, with the sale and hammer price", () => {
    const rows = buildSoldWorks(
      [
        lot("a", {}),
        lot("b", { endTime: new Date("2026-10-24T18:00:00Z"), currentPrice: "2100" }),
        lot("c", { winnerId: null }),
        lot("d", { status: "active", winnerId: null }),
      ],
      { "sale-1": "The First Hammer" },
    );
    expect(rows.map((row) => [row.lotId, row.hammer, row.saleTitle, row.soldOn])).toEqual([
      ["b", "£2,100.00", "The First Hammer", "24 Oct 2026"],
      ["a", "£3,800.00", "The First Hammer", "19 Jun 2026"],
    ]);
  });
});

describe("buildPayoutRows", () => {
  it("shows fees as a deduction and links each statement", () => {
    const [row] = buildPayoutRows(
      [
        {
          id: "p1",
          legalEntityId: "le",
          periodStart: new Date("2026-06-01T00:00:00Z"),
          periodEnd: new Date("2026-06-30T00:00:00Z"),
          grossAmount: "3800",
          platformFee: "456",
          stripeFee: "8.80",
          netAmount: "3335.20",
          currency: "GBP",
          status: "paid",
        } as Payout,
      ],
      "le",
    );
    expect(row).toMatchObject({
      gross: "£3,800.00",
      fees: "-£464.80",
      net: "£3,335.20",
      statementHref: "/legal-entities/le/payouts/p1/statement",
    });
  });
});

describe("buildPayoutDestination", () => {
  it("names what is waiting for the next payout only when there is some", () => {
    expect(
      buildPayoutDestination({
        ready: true,
        preview: { paymentCount: 1, pendingNet: "1722", currency: "GBP" },
      }),
    ).toEqual({ ready: true, pending: "£1,722.00" });
    expect(
      buildPayoutDestination({
        ready: false,
        preview: { paymentCount: 0, pendingNet: "0", currency: "GBP" },
      }),
    ).toEqual({ ready: false, pending: null });
  });
});
