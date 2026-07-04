import type { IBidRepository, ILotRepository } from "@auction/persistence";
import type { IWatchlistRepository } from "@auction/persistence";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../../lib/errors.js";
import type { ILotNotificationCoordinator } from "../interfaces/lot-notifications.js";
import type { LotLifecycleRecording } from "../lot-lifecycle-recording.service.js";
import { bulkPublishOrCancel, cancelLot, publishLot } from "./lot-lifecycle.js";
import type { LotServiceDeps } from "./lot-types.js";

const activeLot: Lot = {
  id: "lot-1",
  title: "Pre-cancel title",
  status: "active",
  saleId: "sale-1",
  sellerLegalEntityId: "le-1",
  startTime: new Date("2030-01-01T10:00:00Z"),
  endTime: new Date("2030-01-01T11:00:00Z"),
} as Lot;

function baseDeps(overrides: Partial<LotServiceDeps> = {}): LotServiceDeps {
  return {
    lotRepo: {} as ILotRepository,
    saleRepo: null,
    bids: { listDistinctBidderIds: vi.fn().mockResolvedValue([]) } as unknown as IBidRepository,
    watchlist: {
      listUserIdsForLot: vi.fn().mockResolvedValue([]),
    } as unknown as IWatchlistRepository,
    jobScheduler: { cancelLotJobs: vi.fn().mockResolvedValue(undefined) } as never,
    lotNotifications: null,
    imageCleanup: undefined,
    legalEntityNotificationRecipients: null,
    legalEntityRepository: null,
    enforceIndividualConnectOnPublish: false,
    adminReviewTaskRepository: null,
    transactionRunner: null,
    domainEventPublisher: null,
    catalogueMediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    englishOnlyAuctions: false,
    lotLifecycleRecording: null,
    qrCodeService: null,
    telephoneBidBookingService: null,
    repoFactory: null,
    ...overrides,
  };
}

describe("cancelLot", () => {
  it("fetches lot before auth check", async () => {
    const findById = vi.fn().mockResolvedValue(null);
    const deps = baseDeps({
      lotRepo: { findById } as unknown as ILotRepository,
    });
    const result = await cancelLot(deps, "admin-1", "buyer", "lot-1");
    expect(findById).toHaveBeenCalledWith("lot-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(LotError);
  });

  it("uses auction.manage auth not canManageCatalogue", async () => {
    const deps = baseDeps({
      lotRepo: {
        findById: vi.fn().mockResolvedValue(activeLot),
      } as unknown as ILotRepository,
    });
    const result = await cancelLot(deps, "admin-1", "buyer", "lot-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthzError);
  });

  it("notifies with pre-cancel lot title", async () => {
    const cancelledLot = { ...activeLot, status: "cancelled" as const, title: "Updated title" };
    const notifyLotCancelled = vi.fn().mockResolvedValue(undefined);
    const findById = vi.fn().mockResolvedValueOnce(activeLot).mockResolvedValueOnce(cancelledLot);
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      lotRepo: { findById, updateStatus } as unknown as ILotRepository,
      lotNotifications: { notifyLotCancelled } as unknown as ILotNotificationCoordinator,
    });
    const result = await cancelLot(deps, "admin-1", "staff", "lot-1", "super_admin");
    expect(result.isOk()).toBe(true);
    expect(notifyLotCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Pre-cancel title" }),
    );
  });

  it("passes cancel reason to lifecycle recording", async () => {
    const cancelledLot = { ...activeLot, status: "cancelled" as const };
    const recordCancelled = vi.fn().mockResolvedValue(undefined);
    const findById = vi.fn().mockResolvedValueOnce(activeLot).mockResolvedValueOnce(cancelledLot);
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const txLotRepo = { updateStatus, findById: vi.fn().mockResolvedValue(cancelledLot) };
    const deps = baseDeps({
      lotRepo: { findById } as unknown as ILotRepository,
      transactionRunner: {
        runInTransaction: vi.fn(async (cb) => cb({} as never)),
      } as never,
      repoFactory: {
        forConnection: vi.fn().mockReturnValue({ lot: txLotRepo }),
      } as never,
      lotLifecycleRecording: { recordCancelled } as unknown as LotLifecycleRecording,
    });
    await cancelLot(deps, "admin-1", "staff", "lot-1", "super_admin", "withdrawal");
    expect(recordCancelled).toHaveBeenCalledWith(
      expect.anything(),
      cancelledLot,
      "withdrawal",
      "admin-1",
    );
  });
});

describe("publishLot", () => {
  it("uses canManageCatalogue auth", async () => {
    const deps = baseDeps({
      lotRepo: {
        findById: vi.fn().mockResolvedValue({ ...activeLot, status: "draft" }),
      } as unknown as ILotRepository,
    });
    const result = await publishLot(deps, "admin-1", "buyer", "lot-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("catalogue");
  });
});

describe("bulkPublishOrCancel", () => {
  it("uses admin_override cancel reason when reason is provided", async () => {
    const cancelledLot = { ...activeLot, status: "cancelled" as const };
    const recordCancelled = vi.fn().mockResolvedValue(undefined);
    const findById = vi.fn().mockResolvedValueOnce(activeLot).mockResolvedValueOnce(cancelledLot);
    const txLotRepo = {
      updateStatus: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(cancelledLot),
    };
    const deps = baseDeps({
      lotRepo: { findById } as unknown as ILotRepository,
      transactionRunner: {
        runInTransaction: vi.fn(async (cb) => cb({} as never)),
      } as never,
      repoFactory: {
        forConnection: vi.fn().mockReturnValue({ lot: txLotRepo }),
      } as never,
      lotLifecycleRecording: { recordCancelled } as unknown as LotLifecycleRecording,
    });
    await bulkPublishOrCancel(deps, "admin-1", "staff", ["lot-1"], "cancel", "super_admin", "ops");
    expect(recordCancelled).toHaveBeenCalledWith(
      expect.anything(),
      cancelledLot,
      "admin_override",
      "admin-1",
    );
  });
});
