import type { BidderReofferRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { type InvoiceLines, bidderReofferViewSchema, buildInvoiceLines } from "@auction/validators";
import { describe, expect, it } from "vitest";
import type { ReofferMemberActor } from "./reoffer-actors.js";
import { ReofferReadsService } from "./reoffer-reads.service.js";

const never = new Proxy({}, { get: () => () => Promise.reject(new Error("reached a dependency")) });

const row = (over: Partial<BidderReofferRow> = {}): BidderReofferRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  lotId: "22222222-2222-4222-8222-222222222222",
  status: "offered",
  amountPence: 8_200_000,
  offerSentAt: new Date("2026-11-11T09:00:00Z"),
  offerEndsAt: new Date("2026-11-14T17:00:00Z"),
  respondedAt: null,
  offeredUserId: "u1",
  offeredLegalEntityId: "e1",
  lot: { title: "The Winter Study", lotNumber: 2, saleId: "s1", image: "winter-study.jpg" },
  lotEndedAt: new Date("2026-10-29T18:00:00Z"),
  ...over,
});

const bidder: ReofferMemberActor = { userId: "u1", legalEntityId: "e1", role: "owner" };

/** The lot as the invoice prices it: its own premium rate, no sale. */
const pricedLot = (buyerPremiumRate: string) =>
  ({ currentPrice: "82000.00", buyerPremiumRate, saleId: null }) as Lot;

/** The real invoice pricing: the page's lines are the invoice's lines, nothing invented. */
const PRICED = buildInvoiceLines(pricedLot("0.25"), null);

function service(rows: BidderReofferRow[], priced: InvoiceLines = PRICED) {
  return new ReofferReadsService({
    db: never as never,
    views: {
      listForBidderAccount: async () => rows,
      findForBidderAccount: async (_entity: string, id: string) =>
        rows.find((r) => r.id === id) ?? null,
    } as never,
    workflow: never as never,
    pricing: { priceFor: async () => priced } as never,
  });
}

describe("the bidder's view of an offer", () => {
  it("names the work, the price line by line and the window, and never the seller", async () => {
    const view = await service([row()]).getForBidder(bidder, row().id);
    expect(view).toMatchObject({
      lotTitle: "The Winter Study",
      lotNumber: 2,
      saleId: "s1",
      lotImage: "winter-study.jpg",
      lotEndedAt: "2026-10-29T18:00:00.000Z",
      status: "offered",
      price: {
        hammerMinor: 8_200_000,
        buyersPremiumMinor: 2_050_000,
        vatOnPremiumMinor: null,
        vatOnLotMinor: null,
        artistsResaleRightMinor: null,
        totalMinor: 10_250_000,
      },
      endsAt: "2026-11-14T17:00:00.000Z",
      respondedAt: null,
      invoiceDueAt: null,
    });
    expect(Object.keys(bidderReofferViewSchema.parse(view)).join()).not.toMatch(/seller|default/i);
  });

  it("shows exactly the invoice's lines: no VAT line while the invoice has none", async () => {
    const view = await service([row()]).getForBidder(bidder, row().id);
    expect(PRICED.lines.map((line) => line.kind)).toEqual(["hammer", "buyers_premium"]);
    expect(view.price.vatOnPremiumMinor).toBeNull();
    expect(view.price.vatOnLotMinor).toBeNull();
    expect(view.price.artistsResaleRightMinor).toBeNull();
    expect(view.price.totalMinor).toBe(PRICED.totalPence);
  });

  it("has no buyer's premium line when the invoice charges none", async () => {
    const view = await service([row()], buildInvoiceLines(pricedLot("0"), null)).getForBidder(
      bidder,
      row().id,
    );
    expect(view.price).toEqual({
      hammerMinor: 8_200_000,
      buyersPremiumMinor: null,
      vatOnPremiumMinor: null,
      vatOnLotMinor: null,
      artistsResaleRightMinor: null,
      totalMinor: 8_200_000,
    });
  });

  it("gives the day the invoice falls due once the offer is accepted", async () => {
    const accepted = row({ status: "accepted", respondedAt: new Date("2026-11-12T10:30:00Z") });
    const view = await service([accepted]).getForBidder(bidder, accepted.id);
    expect(view.status).toBe("accepted");
    expect(view.respondedAt).toBe("2026-11-12T10:30:00.000Z");
    // Seven days on, at the end of that London day.
    expect(view.invoiceDueAt).toBe("2026-11-19T23:59:59.999Z");
  });

  it("does not show an offer the bidder was never told about", async () => {
    await expect(
      service([row({ status: "ready", offerSentAt: null })]).getForBidder(bidder, row().id),
    ).rejects.toMatchObject({ code: "offer_not_found" });
  });

  it("is not found for an id that is not the account's", async () => {
    await expect(service([row()]).getForBidder(bidder, "missing")).rejects.toMatchObject({
      code: "offer_not_found",
    });
  });
});
