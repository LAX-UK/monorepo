import type { PortalPayout, PortalSaleStatement } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { describePayoutStatus } from "./selling-payout-status";
import {
  buildSalesPage,
  describeSalesPeriod,
  parseSalesPeriod,
  salesStatementCsv,
} from "./selling-sales.vm";

const PAYOUT_PAID = "11111111-1111-4111-8111-111111111111";
const PAYOUT_DUE = "22222222-2222-4222-8222-222222222222";
const PAYOUT_WAIT = "33333333-3333-4333-8333-333333333333";

function sale(overrides: Partial<PortalSaleStatement>): PortalSaleStatement {
  return {
    saleId: "44444444-4444-4444-8444-444444444444",
    channel: "direct",
    artworkId: "55555555-5555-4555-8555-555555555555",
    artworkSlug: "harbour-print",
    artworkTitle: "Harbour Print",
    editionNumber: 7,
    soldAt: "2026-09-10T10:00:00Z",
    grossPence: 85_000,
    feesPence: 17_000,
    netPence: 68_000,
    payoutId: PAYOUT_PAID,
    payoutStatus: "paid",
    ...overrides,
  };
}

const payout = (payoutId: string, status: string, dates: Partial<PortalPayout>): PortalPayout => ({
  payoutId,
  grossPence: 0,
  deductionsPence: 0,
  netPence: 0,
  status,
  payoutDueAt: "2036-01-01T00:00:00Z",
  paidAt: null,
  ...dates,
});

const PAYOUTS = [
  payout(PAYOUT_PAID, "paid", { paidAt: "2026-09-18T10:00:00Z" }),
  payout(PAYOUT_DUE, "due", { payoutDueAt: "2026-10-02T10:00:00Z" }),
  payout(PAYOUT_WAIT, "pending_refund_period", {}),
];

const SALES = [
  sale({ saleId: "44444444-4444-4444-8444-444444444441" }),
  sale({
    saleId: "44444444-4444-4444-8444-444444444442",
    channel: "third_party",
    soldAt: "2026-04-01T10:00:00Z",
    payoutId: PAYOUT_DUE,
    payoutStatus: "due",
    grossPence: 40_000,
    feesPence: 4_000,
    netPence: 36_000,
  }),
  sale({
    saleId: "44444444-4444-4444-8444-444444444443",
    channel: "original",
    editionNumber: null,
    artworkTitle: '=HYPERLINK("x"), "Salt"',
    soldAt: "2026-10-20T10:00:00Z",
    payoutId: PAYOUT_WAIT,
    payoutStatus: "pending_refund_period",
    grossPence: 10_000,
    feesPence: 2_000,
    netPence: 8_000,
  }),
];

const NOW = Date.parse("2026-10-25T12:00:00Z");

describe("describePayoutStatus", () => {
  it("dates paid and due payouts, and leaves the refund-period placeholder date out", () => {
    expect(describePayoutStatus("paid", PAYOUTS[0] ?? null).label).toBe("Paid 18 Sept 2026");
    expect(describePayoutStatus("due", PAYOUTS[1] ?? null).label).toBe("Due 2 Oct 2026");
    expect(describePayoutStatus("pending_refund_period", PAYOUTS[2] ?? null).label).toBe(
      "Waiting for refund period to end",
    );
    expect(describePayoutStatus("due", null).label).toBe("Due");
  });

  it("uses one tone per state: paid green, due info, waiting warning, cancelled neutral", () => {
    expect(describePayoutStatus("paid", null).tone).toBe("success");
    expect(describePayoutStatus("due", null).tone).toBe("info");
    expect(describePayoutStatus("pending_refund_period", null).tone).toBe("warning");
    expect(describePayoutStatus("cancelled", null).tone).toBe("neutral");
  });
});

describe("buildSalesPage", () => {
  it("lists every sale newest first in plain words, with totals", () => {
    const page = buildSalesPage(SALES, PAYOUTS, "all", NOW);
    expect(
      page.rows.map((row) => [row.channel, row.edition, row.soldOn, row.payout.label]),
    ).toEqual([
      ["lax.art", null, "20 Oct 2026", "Waiting for refund period to end"],
      ["LAX Shop", "Edition 7", "10 Sept 2026", "Paid 18 Sept 2026"],
      ["Sold outside LAX", "Edition 7", "1 Apr 2026", "Due 2 Oct 2026"],
    ]);
    expect(page.summary).toEqual({
      count: 3,
      salePricePence: 135_000,
      feesPence: 23_000,
      netPence: 112_000,
      paidOutPence: 68_000,
      toComePence: 44_000,
    });
    expect(page.periodRange).toBeNull();
  });

  it("filters to the UK tax year, which starts on 6 April", () => {
    const page = buildSalesPage(SALES, PAYOUTS, "this-tax-year", NOW);
    expect(page.rows).toHaveLength(2);
    expect(page.periodRange).toBe("6 Apr 2026 to 5 Apr 2027");
    const last = buildSalesPage(SALES, PAYOUTS, "last-tax-year", NOW);
    expect(last.rows.map((row) => row.soldOn)).toEqual(["1 Apr 2026"]);
    expect(describeSalesPeriod("last-tax-year", NOW)).toBe("6 Apr 2025 to 5 Apr 2026");
  });

  it("says when sales exist but none fall in the period", () => {
    const page = buildSalesPage(SALES, PAYOUTS, "last-tax-year", Date.parse("2029-01-01"));
    expect(page.noneInPeriod).toBe(true);
    expect(page.totalCount).toBe(3);
  });

  it("falls back to the first period for an unknown query value", () => {
    expect(parseSalesPeriod("forever")).toBe("all");
    expect(parseSalesPeriod(["last-12-months"])).toBe("last-12-months");
  });
});

describe("salesStatementCsv", () => {
  it("writes one line per sale, quoting text and defusing formulas", () => {
    const csv = salesStatementCsv(buildSalesPage(SALES, PAYOUTS, "all", NOW).rows);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "Date sold,Artwork,Edition,Where it sold,Sale price (GBP),LAX fees (GBP),Net to you (GBP),Payout",
    );
    expect(lines[1]).toBe(
      `2026-10-20,"'=HYPERLINK(""x""), ""Salt""",,lax.art,100.00,20.00,80.00,Waiting for refund period to end`,
    );
    expect(lines[2]).toBe(
      "2026-09-10,Harbour Print,Edition 7,LAX Shop,850.00,170.00,680.00,Paid 18 Sept 2026",
    );
  });
});
