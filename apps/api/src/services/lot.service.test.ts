import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILotNotificationCoordinator } from "./interfaces/lot-notifications.js";
import type { IBidRepository, ILotRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import { LotService } from "./lot.service.js";

const lotId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-0000000000c0";

const baseLot: Lot = {
  id: lotId,
  saleId: null,
  lotNumber: 1,
  sellerId: "s1",
  title: "T",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId,
  auctionType: "english",
  startingPrice: "1",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "1",
  buyerPremiumRate: "0.25",
  minBidIncrement: "1",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: { artistNote: "x" },
};

function createSut(overrides: { lot?: Partial<Lot> } = {}) {
  const lot: Lot = { ...baseLot, ...overrides.lot };
  const findById = vi.fn().mockResolvedValue(lot);
  const updateMarketingDetails = vi.fn().mockImplementation(async () => ({
    ...lot,
    marketingDetails: { ...lot.marketingDetails, artistNote: "y" },
  }));
  const lotRepo: ILotRepository = {
    findById,
    updateMarketingDetails,
  } as unknown as ILotRepository;
  const bids = {} as unknown as IBidRepository;
  const watchlist = {} as unknown as IWatchlistRepository;
  const svc = new LotService(lotRepo, bids, watchlist, null, null);
  return { svc, findById, updateMarketingDetails };
}

describe("LotService.updateMarketingDetails", () => {
  it("returns 403 for non-admin", async () => {
    const { svc, findById, updateMarketingDetails } = createSut({});
    const r = await svc.updateMarketingDetails("client", lotId, { artistNote: "z" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(AuthzError);
    expect(findById).not.toHaveBeenCalled();
    expect(updateMarketingDetails).not.toHaveBeenCalled();
  });

  it("returns 404 when lot missing", async () => {
    const { svc, findById } = createSut({});
    findById.mockResolvedValueOnce(null);
    const r = await svc.updateMarketingDetails("administrator", lotId, { artistNote: "z" });
    expect(r.isErr()).toBe(true);
    if (r.isErr() && r.error instanceof LotError) {
      expect(r.error.status).toBe(404);
    }
  });

  it("returns 400 for ended or cancelled", async () => {
    const { svc: s1 } = createSut({ lot: { status: "ended" } });
    const r1 = await s1.updateMarketingDetails("administrator", lotId, { artistNote: "z" });
    expect(r1.isErr()).toBe(true);

    const { svc: s2 } = createSut({ lot: { status: "cancelled" } });
    const r2 = await s2.updateMarketingDetails("administrator", lotId, { artistNote: "z" });
    expect(r2.isErr()).toBe(true);
  });

  it("updates via repo for admin and allowed status", async () => {
    const { svc, updateMarketingDetails } = createSut({});
    const r = await svc.updateMarketingDetails("administrator", lotId, { artistNote: "new" });
    expect(r.isOk()).toBe(true);
    expect(updateMarketingDetails).toHaveBeenCalledWith(lotId, { artistNote: "new" });
  });
});

describe("LotService.cancel", () => {
  it("routes seller cancellation notifications to legal entity seller members", async () => {
    const activeLot: Lot = {
      ...baseLot,
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000010",
    };
    const cancelledLot: Lot = { ...activeLot, status: "cancelled" };
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValueOnce(activeLot).mockResolvedValueOnce(cancelledLot),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ILotRepository;
    const bids: IBidRepository = {
      listDistinctBidderIds: vi.fn().mockResolvedValue(["bidder-1"]),
    } as unknown as IBidRepository;
    const watchlist: IWatchlistRepository = {
      listUserIdsForLot: vi.fn().mockResolvedValue(["watcher-1"]),
    } as unknown as IWatchlistRepository;
    const lotNotifications: ILotNotificationCoordinator = {
      notifyLotCancelled: vi.fn().mockResolvedValue(undefined),
    };
    const legalEntityRecipients: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue(["owner-1", "consignor-1"]),
    };
    const svc = new LotService(
      lotRepo,
      bids,
      watchlist,
      {
        scheduleLot: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotJobs: vi.fn().mockResolvedValue(undefined),
      },
      lotNotifications,
      undefined,
      legalEntityRecipients,
    );

    const result = await svc.cancel("admin-1", "administrator", lotId);

    expect(result.isOk()).toBe(true);
    expect(legalEntityRecipients.listUserIdsForAudience).toHaveBeenCalledWith(
      activeLot.sellerLegalEntityId,
      "seller",
    );
    expect(lotNotifications.notifyLotCancelled).toHaveBeenCalledWith({
      lotId,
      title: activeLot.title,
      recipientIds: ["bidder-1", "watcher-1", "owner-1", "consignor-1"],
    });
  });
});
