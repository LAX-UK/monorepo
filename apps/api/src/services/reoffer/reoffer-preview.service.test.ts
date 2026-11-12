import type { Database } from "@auction/db";
import type { PlacedBid, PriorOffer } from "@auction/domain";
import type { IReofferStaffReader, StaffBuyerDefaultView } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ReofferError } from "./reoffer-errors.js";
import { ReofferPreviewService } from "./reoffer-preview.service.js";

const db = {} as Database;
const BUYER = { userId: "buyer", legalEntityId: "buyer-entity" };

function bid(userId: string, amountMinor: number, state: PlacedBid["accountState"] = "active") {
  return {
    bidId: `bid-${userId}-${amountMinor}`,
    userId,
    legalEntityId: `${userId}-entity`,
    amountMinor,
    placedAt: new Date("2026-10-23T18:11:00.000Z"),
    accountState: state,
  };
}

type Setup = {
  winner?: boolean;
  atg?: boolean;
  bids?: ReturnType<typeof bid>[];
  latest?: boolean;
  prior?: PriorOffer[];
  reservePence?: number | null;
  deleted?: boolean;
  noLot?: boolean;
};

function service(setup: Setup = {}) {
  const staff: IReofferStaffReader = {
    lotFacts: vi.fn().mockResolvedValue(
      setup.noLot
        ? null
        : {
            id: "lot",
            status: "ended",
            winnerId: setup.winner === false || setup.latest ? null : BUYER.userId,
            winnerLegalEntityId:
              setup.winner === false || setup.latest ? null : BUYER.legalEntityId,
            reservePence: setup.reservePence ?? null,
            deleted: setup.deleted ?? false,
          },
    ),
    latestDefaultView: vi.fn(),
    accountNames: vi.fn().mockResolvedValue(new Map([["hollis-entity", "Hollis Byrne"]])),
  };
  const preview = new ReofferPreviewService({
    db,
    staff,
    workflow: {
      latestDefault: vi
        .fn()
        .mockResolvedValue(
          setup.latest
            ? { id: "default", buyerId: BUYER.userId, buyerLegalEntityId: BUYER.legalEntityId }
            : null,
        ),
      placedBids: vi
        .fn()
        .mockResolvedValue(
          setup.bids ?? [bid("buyer", 8_800_000), bid("hollis", 7_500_000), bid("ada", 6_000_000)],
        ),
      priorOffers: vi.fn().mockResolvedValue(setup.prior ?? []),
    },
    atg: { soldOnAtg: vi.fn().mockResolvedValue(setup.atg ?? false) },
  });
  return { preview, staff };
}

describe("the next bidder preview", () => {
  it("names the bidder after the winner, at their own placed bid, with the bidders after them", async () => {
    const { preview } = service();
    const result = await preview.previewForLot("lot");
    expect(result.next).toMatchObject({
      userId: "hollis",
      accountName: "Hollis Byrne",
      bidMinor: 7_500_000,
      belowReserve: false,
      othersAfter: 1,
    });
    expect(result.noneReason).toBeNull();
  });

  it("flags a bid below the reserve", async () => {
    const { preview } = service({ reservePence: 8_000_000 });
    expect((await preview.previewForLot("lot")).next?.belowReserve).toBe(true);
  });

  it("works from the defaulting buyer once the default is recorded, skipping bidders already offered", async () => {
    const offered: PriorOffer = {
      userId: "hollis",
      legalEntityId: "hollis-entity",
      status: "declined",
      offerSentAt: new Date("2026-11-11T10:00:00.000Z"),
    };
    const { preview } = service({ latest: true, prior: [offered] });
    const result = await preview.previewForLot("lot");
    expect(result.next?.userId).toBe("ada");
    expect(result.offersMade).toBe(1);
    expect(result.next?.othersAfter).toBe(0);
  });

  it.each<[string, Setup, string]>([
    ["no one else bid", { bids: [bid("buyer", 8_800_000)] }, "no_other_bidder"],
    [
      "every other account is unavailable",
      { bids: [bid("buyer", 8_800_000), bid("hollis", 7_500_000, "suspended")] },
      "no_eligible_bidder",
    ],
    ["there is no buyer", { winner: false }, "no_buyer"],
  ])("says why there is nobody when %s", async (_name, setup, reason) => {
    const { preview } = service(setup);
    const result = await preview.previewForLot("lot");
    expect(result.next).toBeNull();
    expect(result.noneReason).toBe(reason);
  });

  it("lists the accounts it passed over", async () => {
    const { preview } = service({
      bids: [bid("buyer", 8_800_000), bid("closed", 8_000_000, "closed"), bid("hollis", 7_500_000)],
    });
    const result = await preview.previewForLot("lot");
    expect(result.skippedBidders).toEqual([
      {
        userId: "closed",
        legalEntityId: "closed-entity",
        amountMinor: 8_000_000,
        reason: "closed",
      },
    ]);
    expect(result.next?.userId).toBe("hollis");
  });

  it("offers nothing for a lot sold on ATG, which has no LAX buyer", async () => {
    const { preview, staff } = service({ atg: true });
    expect(await preview.previewForLot("lot")).toMatchObject({ soldOnAtg: true, next: null });
    expect(staff.accountNames).not.toHaveBeenCalled();
  });

  it("refuses a lot that does not exist or was deleted", async () => {
    for (const setup of [{ noLot: true }, { deleted: true }]) {
      await expect(service(setup).preview.previewForLot("lot")).rejects.toBeInstanceOf(
        ReofferError,
      );
    }
  });
});

describe("the buyer default read", () => {
  const view: StaffBuyerDefaultView = {
    id: "default",
    recordedAt: new Date("2026-11-10T10:12:00.000Z"),
    recordedByName: "Eleanor Pereira",
    reason: "No payment.",
    outcome: "offered_to_underbidder",
    originalHammerPence: 8_800_000,
    wonAt: new Date("2026-10-29T18:42:00.000Z"),
    buyerRestricted: true,
    buyerUserId: "buyer",
    buyerAccountName: "Defaulting Ltd",
    voidedInvoiceNumber: "LAX-B-2026-0412",
    voidedInvoiceTotalPence: 11_440_000,
    voidedInvoiceDueAt: new Date("2026-11-05T23:59:00.000Z"),
  };

  it("hands staff the facts of the void, and nothing when there was no default", async () => {
    const { preview, staff } = service();
    vi.mocked(staff.latestDefaultView).mockResolvedValueOnce(view);
    expect(await preview.buyerDefaultForLot("lot")).toMatchObject({
      originalHammerMinor: 8_800_000,
      voidedInvoiceNumber: "LAX-B-2026-0412",
      recordedAt: "2026-11-10T10:12:00.000Z",
    });
    vi.mocked(staff.latestDefaultView).mockResolvedValueOnce(null);
    expect(await preview.buyerDefaultForLot("lot")).toBeNull();
  });
});
