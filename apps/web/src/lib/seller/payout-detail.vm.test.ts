import type { PayoutDetail, PayoutLine } from "@/lib/data/http/workspace-selling.schema";
import { describe, expect, it } from "vitest";
import { payoutDetailVm, payoutLinesVm } from "./payout-detail.vm";
import { snapshotFixture } from "./seller-terms-fixture.test-util";

const NOW = new Date("2026-11-13T12:00:00Z");

const sale = (id: string, over: Partial<PayoutLine>): PayoutLine => ({
  id,
  kind: "sale",
  note: null,
  lot: { id: `lot-${id}`, title: "Harbour at Dusk", lotNumber: 31, hammerPrice: "82000.00" },
  breakdown: null,
  sellerTerms: null,
  soldAfterAuction: false,
  amount: "0",
  ...over,
});

const detail = (lines: PayoutLine[], over: Partial<PayoutDetail> = {}): PayoutDetail => ({
  id: "5b400001-0000",
  status: "paid",
  currency: "GBP",
  grossAmount: "82000.00",
  platformFee: "14760.00",
  stripeFee: "0.00",
  netAmount: "67240.00",
  periodStart: new Date("2026-11-01T00:00:00Z"),
  periodEnd: new Date("2026-11-11T00:00:00Z"),
  processedAt: new Date("2026-11-12T04:49:00Z"),
  lines,
  ...over,
});

describe("payoutLinesVm", () => {
  it("shows the real hammer, the commission and VAT at their rates, and what the seller receives", () => {
    const vm = payoutLinesVm(
      detail([
        sale("a", {
          amount: "82000.00",
          breakdown: { gross: "82000.00", commissionAndFees: "14760.00", net: "67240.00" },
          sellerTerms: snapshotFixture(8_200_000, 1500),
        }),
      ]),
    );
    expect(vm.lines[0]).toMatchObject({
      work: "Harbour at Dusk",
      lot: "Lot 31",
      receive: "£67,240.00",
      note: null,
      sale: {
        hammer: "£82,000.00",
        commission: { amount: "−£12,300.00", rate: "15%" },
        vat: { amount: "−£2,460.00", rate: "20%" },
      },
    });
    expect(vm.totals).toEqual({
      hammer: "£82,000.00",
      commission: "−£12,300.00",
      vat: "−£2,460.00",
      charges: "£14,760.00",
      receive: "£67,240.00",
    });
    expect(vm.notes).toEqual([
      "Commission is charged on the hammer price at the rate in your signed agreement, plus VAT. The buyer's premium is paid to LAX and isn't part of your proceeds.",
    ]);
  });

  it("totals are the sums of the lines, refunds and the transfer fee included", () => {
    const vm = payoutLinesVm(
      detail(
        [
          sale("a", { sellerTerms: snapshotFixture(8_200_000, 1500) }),
          sale("b", {
            lot: { id: "lot-b", title: "Small Study", lotNumber: 32, hammerPrice: "333.00" },
            sellerTerms: snapshotFixture(33_300, 1250),
          }),
          {
            ...sale("c", {}),
            kind: "refund",
            lot: null,
            amount: "-50.00",
            note: "Frame damaged",
          },
        ],
        { stripeFee: "8.80" },
      ),
    );
    expect(vm.lines.map((line) => [line.work, line.receive])).toEqual([
      ["Harbour at Dusk", "£67,240.00"],
      ["Small Study", "£283.04"],
      ["Refund to a buyer", "-£50.00"],
      ["Transfer fee", "−£8.80"],
    ]);
    expect(vm.lines[1]?.sale?.commission).toEqual({ amount: "−£41.63", rate: "12.5%" });
    expect(vm.totals).toEqual({
      hammer: "£82,333.00",
      commission: "−£12,341.63",
      vat: "−£2,468.33",
      charges: "£14,809.96",
      receive: "£67,464.24",
    });
  });

  it("says no VAT was charged when the company was not VAT-registered", () => {
    const vm = payoutLinesVm(
      detail([sale("a", { sellerTerms: snapshotFixture(8_200_000, 1500, "not_registered") })]),
    );
    expect(vm.lines[0]?.sale).toMatchObject({ noVat: true, vat: { rate: null } });
    expect(vm.notes).toContain("No VAT: London Auction Xchange LTD is not VAT-registered");
  });

  it("shows a sale paid under the old rule as recorded, with the lot's hammer, never the payment", () => {
    const vm = payoutLinesVm(
      detail([
        sale("a", {
          amount: "102500.00",
          // The old rule split the buyer's payment (hammer and premium): as it was recorded.
          breakdown: { gross: "102500.00", commissionAndFees: "5125.00", net: "97375.00" },
        }),
      ]),
    );
    expect(vm.lines[0]).toMatchObject({
      receive: "£97,375.00",
      note: "Paid before commission and VAT were shown apart: the figures as recorded.",
      sale: { hammer: "£82,000.00", commission: { amount: "−£5,125.00", rate: null }, vat: null },
    });
    expect(vm.totals.hammer).toBe("£82,000.00");
  });
});

describe("payoutDetailVm", () => {
  it("titles the payout with its amount and dates it in the shared style", () => {
    const vm = payoutDetailVm(
      detail([sale("a", { sellerTerms: snapshotFixture(8_200_000, 1500) })]),
      { sellerEntityId: "le-1", now: NOW },
    );
    expect(vm.title).toBe("Payout of £67,240.00");
    expect(vm.statusNote).toBe("Arrived yesterday");
    expect(vm.totals.receive).toBe("£67,240.00");
  });
});
