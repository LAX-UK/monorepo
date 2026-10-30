import type { EntityWonLot } from "@/lib/data/http/payments.schema";
import type { PayoutDetail, SoldLot } from "@/lib/data/http/workspace-selling.schema";
import { describe, expect, it } from "vitest";
import { boughtWork, returnedWork, worksInView } from "./collection-works";
import { payoutDetailVm } from "./payout-detail.vm";
import { sendToSpecialistsLabel } from "./sell-flow";
import {
  parseSoldListQuery,
  soldInView,
  soldListSearch,
  soldRecord,
  soldYears,
} from "./sold-and-payouts-list";

const NOW = new Date("2026-10-30T12:00:00Z");

function sold(id: string, overrides: Partial<SoldLot> = {}): SoldLot {
  return {
    lotId: id,
    lotTitle: `Work ${id}`,
    lotNumber: 31,
    saleTitle: "Autumn Modern British",
    soldAt: new Date("2026-10-22T18:00:00Z"),
    hammerPrice: "9200.00",
    stage: "buyer_paying",
    net: null,
    payout: null,
    ...overrides,
  };
}

describe("soldRecord", () => {
  it("reads where the money stands, with the date once it is paid out", () => {
    const paying = soldRecord(sold("a"), NOW);
    expect(paying.badge.label).toBe("Buyer paying");
    expect(paying.net).toBeNull();
    expect(paying.hammer).toBe("£9,200");
    expect(paying.meta).toEqual(["Autumn Modern British", "lot 31", "sold 22 Oct"]);
    const paid = soldRecord(
      sold("b", {
        stage: "paid_out",
        net: "8096.00",
        payout: { id: "p1", settledAt: new Date("2026-09-26T10:00:00Z") },
      }),
      NOW,
    );
    expect(paid.badge.label).toBe("Paid out 26 Sept");
    expect(paid.net).toBe("£8,096.00");
    expect(paid.payoutHref).toBe("/selling/payouts/p1");
  });

  it("filters by year and sorts, keeping the address short", () => {
    const records = [
      soldRecord(sold("a", { hammerPrice: "100" }), NOW),
      soldRecord(sold("b", { soldAt: new Date("2025-05-01T10:00:00Z"), hammerPrice: "500" }), NOW),
    ];
    expect(soldYears(records)).toEqual([2026, 2025]);
    const query = parseSoldListQuery({ year: "2025" });
    expect(soldInView(records, query).map((r) => r.lotId)).toEqual(["b"]);
    expect(soldInView(records, { ...query, year: null, sort: "highest" })[0]?.lotId).toBe("b");
    expect(soldListSearch({ view: "sold", q: "", year: null, sort: "newest" })).toBe("?tab=sold");
    expect(parseSoldListQuery({ year: "1999" }).year).toBeNull();
  });
});

describe("payoutDetailVm", () => {
  const detail: PayoutDetail = {
    id: "5b400001-0000",
    status: "in_transit",
    currency: "GBP",
    grossAmount: "15344.00",
    platformFee: "2484.00",
    stripeFee: "0.00",
    netAmount: "12860.00",
    periodStart: new Date("2026-10-10T00:00:00Z"),
    periodEnd: new Date("2026-10-28T00:00:00Z"),
    processedAt: new Date("2026-10-29T10:00:00Z"),
    lines: [
      {
        id: "l1",
        kind: "sale",
        note: null,
        lot: { id: "lot", title: "Marsh in October", lotNumber: 7, hammerPrice: "14600.00" },
        breakdown: { gross: "14600.00", commissionAndFees: "2363.40", net: "12236.60" },
        amount: "14600.00",
      },
      {
        id: "l2",
        kind: "refund",
        note: "Frame damaged",
        lot: null,
        breakdown: null,
        amount: "-50.00",
      },
    ],
  };

  it("splits each sale and names other lines in the seller's words", () => {
    const vm = payoutDetailVm(detail, { sellerEntityId: "le-1", now: NOW });
    expect(vm.title).toBe("Payout of £12,860.00");
    expect(vm.status.label).toBe("On its way");
    expect(vm.statusNote).toBe("Sent yesterday, usually 2 working days");
    expect(vm.lines[0]).toMatchObject({ lot: "Lot 7", fees: "-£2,363.40", receive: "£12,236.60" });
    expect(vm.lines[1]).toMatchObject({
      work: "Refund to a buyer",
      hammer: null,
      receive: "-£50.00",
    });
    expect(vm.statementHref).toBe("/legal-entities/le-1/payouts/5b400001-0000/statement");
  });
});

describe("collection works", () => {
  const win: EntityWonLot = {
    lotId: "l1",
    lotNumber: 44,
    title: "Low cloud, Rye",
    imageUrl: null,
    endedAt: "2026-10-22T18:00:00Z",
    hammerPrice: "4160",
  };

  it("offers Consign this work with the details carried, and where the work is", () => {
    const work = boughtWork(
      win,
      { delivery: { stage: "delivered" } } as Parameters<typeof boughtWork>[1],
      { now: NOW, canSell: true },
    );
    expect(work.where?.label).toBe("Delivered");
    expect(work.consignHref).toBe("/selling/new?fromLot=l1");
    expect(work.href).toBe("/purchases/l1");
    // Without the purchase records, the row opens the lot rather than a page the member cannot read.
    expect(boughtWork(win, undefined, { now: NOW, canSell: false }).href).not.toContain(
      "/purchases",
    );
  });

  it("marks a returned work and lets it be consigned again only when the member may", () => {
    const work = returnedWork(
      {
        submissionId: "s1",
        lotId: "l9",
        title: "Night harbour",
        medium: null,
        reference: "C-1987",
        returnedAt: new Date("2026-10-22T10:00:00Z"),
        canConsignAgain: false,
      },
      { now: NOW },
    );
    expect(work.meta).toEqual(["returned unsold 22 Oct", "C-1987"]);
    expect(work.canConsign).toBe(false);
    expect(work.consignLabel).toBe("Consign again");
    expect(worksInView([work], { q: "harbour", sort: "newest" })).toHaveLength(1);
  });
});

describe("sendToSpecialistsLabel", () => {
  it("names the organisation the work is sent for", () => {
    expect(sendToSpecialistsLabel({ kind: "organisation", name: "Northbank Gallery" })).toBe(
      "Send to our specialists for Northbank Gallery",
    );
    expect(sendToSpecialistsLabel({ kind: "personal", name: "Maya" })).toBe(
      "Send to our specialists",
    );
  });
});
