import type { SellerConsentRequestRow } from "@auction/persistence/interfaces";
import { sellerReofferViewSchema } from "@auction/validators";
import { describe, expect, it } from "vitest";
import type { ReofferMemberActor } from "./reoffer-actors.js";
import { ReofferReadsService } from "./reoffer-reads.service.js";

const never = new Proxy({}, { get: () => () => Promise.reject(new Error("reached a dependency")) });

const row = (over: Partial<SellerConsentRequestRow> = {}): SellerConsentRequestRow => ({
  reofferId: "11111111-1111-4111-8111-111111111111",
  lotId: "22222222-2222-4222-8222-222222222222",
  offerStatus: "awaiting_seller",
  consentStatus: "requested",
  terms: {
    amountPence: 8_200_000,
    originalHammerPence: 8_800_000,
    saleAtOfferPence: 9_840_000,
    proceedsAtOfferPence: 9_348_000,
    proceedsAtOriginalPence: 10_032_000,
    reservePence: 8_000_000,
  },
  dueAt: new Date("2026-11-13T17:00:00Z"),
  lot: { title: "The Winter Study", lotNumber: 2, endedAt: new Date("2026-10-29T18:00:00Z") },
  answeredAt: null,
  answerChannel: null,
  preferredNext: null,
  offerEndsAt: null,
  respondedAt: null,
  ...over,
});

const owner: ReofferMemberActor = { userId: "u1", legalEntityId: "e1", role: "owner" };

function service(rows: SellerConsentRequestRow[]) {
  return new ReofferReadsService({
    db: never as never,
    views: {
      listForSellerAccount: async () => rows,
      findForSellerAccount: async (_entity: string, id: string) =>
        rows.find((r) => r.reofferId === id) ?? null,
    } as never,
    workflow: never as never,
    pricing: never as never,
  });
}

describe("the seller's view of a request", () => {
  it("names the work and the terms they saw, and never a bidder", async () => {
    const [view] = await service([row()]).listForSeller(owner);
    expect(view).toMatchObject({
      lotTitle: "The Winter Study",
      lotNumber: 2,
      lotEndedAt: "2026-10-29T18:00:00.000Z",
      offerMinor: 8_200_000,
      proceeds: {
        offerSaleMinor: 9_840_000,
        offerProceedsMinor: 9_348_000,
        originalHammerMinor: 8_800_000,
        originalProceedsMinor: 10_032_000,
      },
      belowReserve: false,
      answerDueAt: "2026-11-13T17:00:00.000Z",
      answeredAt: null,
      answeredBy: null,
      soldAt: null,
    });
    expect(Object.keys(sellerReofferViewSchema.parse(view)).join()).not.toMatch(/bidder|user/i);
  });

  it("says how an answer reached us and what the seller prefers", async () => {
    const answered = row({
      offerStatus: "seller_declined",
      consentStatus: "refused",
      answeredAt: new Date("2026-11-11T10:00:00Z"),
      answerChannel: "recorded_by_staff",
      preferredNext: "later_sale",
    });
    const view = await service([answered]).getForSeller(owner, answered.reofferId);
    expect(view).toMatchObject({
      answeredBy: "recorded_by_staff",
      declinePreference: "later_sale",
      answeredAt: "2026-11-11T10:00:00.000Z",
    });
  });

  it("shows when the next bidder's offer ends, and when it sold", async () => {
    const sold = row({
      offerStatus: "accepted",
      consentStatus: "given",
      offerEndsAt: new Date("2026-11-14T17:00:00Z"),
      respondedAt: new Date("2026-11-12T09:00:00Z"),
    });
    const view = await service([sold]).getForSeller(owner, sold.reofferId);
    expect(view.offerEndsAt).toBe("2026-11-14T17:00:00.000Z");
    expect(view.soldAt).toBe("2026-11-12T09:00:00.000Z");
    const declined = row({
      offerStatus: "declined",
      consentStatus: "given",
      respondedAt: new Date("2026-11-12T09:00:00Z"),
    });
    expect((await service([declined]).getForSeller(owner, declined.reofferId)).soldAt).toBeNull();
  });

  it("flags an offer below the agreed reserve", async () => {
    const [view] = await service([
      row({ terms: { ...row().terms, amountPence: 7_500_000 } }),
    ]).listForSeller(owner);
    expect(view?.belowReserve).toBe(true);
  });

  it("reads a request started before the sale total was kept as worked out on the hammer", async () => {
    const { saleAtOfferPence: _kept, ...older } = row().terms;
    const [view] = await service([row({ terms: older })]).listForSeller(owner);
    expect(view?.proceeds?.offerSaleMinor).toBe(8_200_000);
  });

  // Only the members who see the account's payouts see its money, as on Sold & payouts.
  it.each(["owner", "admin", "finance"] as const)("gives a %s the proceeds", async (role) => {
    const actor: ReofferMemberActor = { ...owner, role };
    const [listed] = await service([row()]).listForSeller(actor);
    const opened = await service([row()]).getForSeller(actor, row().reofferId);
    expect(listed?.proceeds?.offerProceedsMinor).toBe(9_348_000);
    expect(opened.proceeds?.offerProceedsMinor).toBe(9_348_000);
  });

  it.each(["viewer", "consignor"] as const)("gives a %s no proceeds", async (role) => {
    const actor: ReofferMemberActor = { ...owner, role };
    const [listed] = await service([row()]).listForSeller(actor);
    const opened = await service([row()]).getForSeller(actor, row().reofferId);
    for (const view of [listed, opened]) {
      expect(view?.proceeds).toBeNull();
      expect(view?.offerMinor).toBe(8_200_000);
      expect(JSON.stringify(view)).not.toMatch(/9348000|10032000|9840000|8800000/);
    }
  });

  it("does not list lots LAX owns", async () => {
    expect(await service([row({ consentStatus: "not_needed" })]).listForSeller(owner)).toEqual([]);
  });
});

describe("the agreement's rate beside the seller's figure", () => {
  const withRate = (bps: number | null) => {
    const asked: Array<[string, string]> = [];
    const reads = new ReofferReadsService({
      db: never as never,
      views: {
        listForSellerAccount: async () => [row()],
        findForSellerAccount: async () => row(),
      } as never,
      workflow: never as never,
      pricing: never as never,
      sellerRate: {
        commissionBpsFor: async (lotId, entity) => {
          asked.push([lotId, entity]);
          return bps;
        },
      },
    });
    return { reads, asked };
  };

  it("carries the signed agreement's rate with the stored proceeds", async () => {
    const { reads, asked } = withRate(1500);
    const view = await reads.getForSeller(owner, "any");
    expect(view.proceeds).toMatchObject({ offerProceedsMinor: 9_348_000, commissionBps: 1500 });
    expect(asked).toEqual([["22222222-2222-4222-8222-222222222222", "e1"]]);
  });

  it("does not read the rate for a member who does not see the money", async () => {
    const { reads, asked } = withRate(1500);
    const [view] = await reads.listForSeller({ ...owner, role: "viewer" });
    expect(view?.proceeds).toBeNull();
    expect(asked).toEqual([]);
  });

  it("leaves the rate out when there is no signed agreement to read it from", async () => {
    const { reads } = withRate(null);
    const [view] = await reads.listForSeller(owner);
    expect(view?.proceeds?.commissionBps).toBeNull();
  });
});
