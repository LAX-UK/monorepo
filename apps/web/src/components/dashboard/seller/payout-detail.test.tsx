import type { PayoutDetail as PayoutDetailData } from "@/lib/data/http/workspace-selling.schema";
import { payoutDetailVm } from "@/lib/seller/payout-detail.vm";
import { snapshotFixture } from "@/lib/seller/seller-terms-fixture.test-util";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PayoutDetail } from "./payout-detail";

const detail: PayoutDetailData = {
  id: "5b400001-0000",
  status: "paid",
  currency: "GBP",
  // The old header split: the buyer paid £102,500.00 with the premium. Never shown as the hammer.
  grossAmount: "82000.00",
  platformFee: "14760.00",
  stripeFee: "0.00",
  netAmount: "67240.00",
  periodStart: new Date("2026-11-01T00:00:00Z"),
  periodEnd: new Date("2026-11-11T00:00:00Z"),
  processedAt: new Date("2026-11-12T04:49:00Z"),
  lines: [
    {
      id: "a",
      kind: "sale",
      note: null,
      lot: { id: "lot", title: "Harbour at Dusk", lotNumber: 31, hammerPrice: "82000.00" },
      breakdown: { gross: "82000.00", commissionAndFees: "14760.00", net: "67240.00" },
      sellerTerms: snapshotFixture(8_200_000, 1500),
      soldAfterAuction: false,
      amount: "82000.00",
    },
  ],
};

function renderPayout(over: Partial<PayoutDetailData> = {}) {
  const vm = payoutDetailVm(
    { ...detail, ...over },
    { sellerEntityId: "le-1", now: new Date("2026-11-13T12:00:00Z") },
  );
  return render(<PayoutDetail vm={vm} />);
}

describe("PayoutDetail", () => {
  it("leads with the hammer, the commission and VAT, and the status", () => {
    renderPayout();
    const summary = screen.getByText("Commission and VAT").closest("dl");
    if (!summary) throw new Error("summary list");
    expect(within(summary).getByText("Hammer")).toBeInTheDocument();
    expect(within(summary).getByText("£14,760.00")).toBeInTheDocument();
    expect(within(summary).getByText("Status")).toBeInTheDocument();
  });

  it("lists each sale in the agreed columns, with rates, and totals that are the lines added up", () => {
    renderPayout();
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Work", "Lot", "Hammer", "Commission", "VAT on commission", "You receive"]);
    const [, row, totals] = within(table).getAllByRole("row");
    if (!row || !totals) throw new Error("table rows");
    expect(within(row).getByText("£82,000.00")).toBeInTheDocument();
    expect(within(row).getByText("15%")).toBeInTheDocument();
    expect(within(row).getByText("20%")).toBeInTheDocument();
    expect(row.textContent).toContain("−£12,300.00");
    expect(row.textContent).toContain("−£2,460.00");
    expect(row.textContent).toContain("£67,240.00");
    expect(totals.textContent).toBe("Total£82,000.00−£12,300.00−£2,460.00£67,240.00");
    expect(screen.queryByText(/premium \+|102,500/)).toBeNull();
    expect(
      screen.getByText(
        "Commission is charged on the hammer price at the rate in your signed agreement, plus VAT. The buyer's premium is paid to LAX and isn't part of your proceeds.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps what the seller receives and each rate on a phone", () => {
    renderPayout();
    const list = screen.getAllByRole("list").find((ul) => ul.className.includes("md:hidden"));
    if (!list) throw new Error("phone list");
    expect(list.textContent).toContain("£67,240.00");
    expect(list.textContent).toContain(
      "Lot 31 · hammer £82,000.00 · commission 15% −£12,300.00 · VAT 20% −£2,460.00",
    );
  });

  it("keeps each signed amount whole, with the one minus sign, on a phone and a wide page", () => {
    const { container } = renderPayout();
    for (const amount of ["−£12,300.00", "−£2,460.00"]) {
      const spans = [...container.querySelectorAll("span.whitespace-nowrap")].filter(
        (span) => span.textContent === amount,
      );
      // The table cell, the phone line, and the phone totals.
      expect(spans).toHaveLength(3);
    }
    // No other dash stands in for a minus anywhere on the page.
    expect(container.textContent).not.toMatch(/[-–]£/);
  });

  it("says no VAT when the company was not VAT-registered", () => {
    renderPayout({
      lines: detail.lines.map((line) => ({
        ...line,
        sellerTerms: snapshotFixture(8_200_000, 1500, "not_registered"),
      })),
    });
    expect(
      screen.getByText("No VAT: London Auction Xchange LTD is not VAT-registered"),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("No VAT")).toBeInTheDocument();
  });
});
