import type { Database } from "@auction/db";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { ILotRepository } from "@auction/persistence";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { LotLifecycleRecording } from "../lot-lifecycle-recording.service.js";
import type { LotServiceDeps } from "./lot-types.js";
import { approveWithdrawalRequest, requestWithdrawal } from "./lot-withdrawal.js";

const activeLot: Lot = {
  id: "lot-1",
  title: "Test lot",
  status: "active",
  sellerLegalEntityId: "le-1",
  startTime: new Date("2030-01-01T10:00:00Z"),
  endTime: new Date("2030-01-01T11:00:00Z"),
} as Lot;

function makeAdminReviewTaskRepo(
  overrides: Partial<{
    findPendingLotWithdrawal: ReturnType<typeof vi.fn>;
    createLotWithdrawalRequest: ReturnType<typeof vi.fn>;
    resolveLotWithdrawal: ReturnType<typeof vi.fn>;
  }> = {},
) {
  const repo = {
    findPendingLotWithdrawal: vi.fn().mockResolvedValue(null),
    createLotWithdrawalRequest: vi.fn().mockResolvedValue({ id: "task-1" }),
    resolveLotWithdrawal: vi.fn().mockResolvedValue(undefined),
    forConnection: vi.fn(),
    ...overrides,
  };
  repo.forConnection.mockReturnValue(repo);
  return repo;
}

function baseDeps(overrides: Partial<LotServiceDeps> = {}): LotServiceDeps {
  return {
    lotRepo: {} as ILotRepository,
    saleRepo: null,
    bids: { listDistinctBidderIds: vi.fn().mockResolvedValue([]) } as never,
    watchlist: { listUserIdsForLot: vi.fn().mockResolvedValue([]) } as never,
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

describe("requestWithdrawal", () => {
  it("publishes fallback event inside task insert transaction when lifecycle absent", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const tx = {} as Database;
    const db = {
      transaction: vi.fn(async (cb: (txArg: typeof tx) => Promise<string>) => cb(tx)),
    };
    const adminReviewTaskRepository = makeAdminReviewTaskRepo();
    const deps = baseDeps({
      transactionRunner: transactionRunnerFromDb(db as unknown as Database),
      domainEventPublisher: { publish } as unknown as DomainEventPublisher,
      adminReviewTaskRepository: adminReviewTaskRepository as never,
      legalEntityRepository: {
        findActiveMembership: vi.fn().mockResolvedValue({ role: "owner" }),
      } as unknown as ILegalEntityRepository,
      lotRepo: { findById: vi.fn().mockResolvedValue(activeLot) } as unknown as ILotRepository,
    });

    const result = await requestWithdrawal(deps, "seller-1", "lot-1");
    expect(result.isOk()).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "lot.withdrawal_requested",
        payload: { sellerLegalEntityId: "le-1" },
      }),
    );
  });

  it("uses lifecycle recording when configured instead of publisher", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const recordWithdrawalRequested = vi.fn().mockResolvedValue(undefined);
    const tx = {} as Database;
    const db = {
      transaction: vi.fn(async (cb: (txArg: typeof tx) => Promise<string>) => cb(tx)),
    };
    const deps = baseDeps({
      transactionRunner: transactionRunnerFromDb(db as unknown as Database),
      domainEventPublisher: { publish } as unknown as DomainEventPublisher,
      adminReviewTaskRepository: makeAdminReviewTaskRepo() as never,
      legalEntityRepository: {
        findActiveMembership: vi.fn().mockResolvedValue({ role: "admin" }),
      } as unknown as ILegalEntityRepository,
      lotLifecycleRecording: {
        recordWithdrawalRequested,
      } as unknown as LotLifecycleRecording,
      lotRepo: { findById: vi.fn().mockResolvedValue(activeLot) } as unknown as ILotRepository,
    });

    await requestWithdrawal(deps, "seller-1", "lot-1");
    expect(recordWithdrawalRequested).toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("approveWithdrawalRequest", () => {
  it("updates task outside cancel transaction", async () => {
    const cancelledLot = { ...activeLot, status: "cancelled" as const };
    const resolveLotWithdrawal = vi.fn().mockResolvedValue(undefined);
    const findById = vi.fn().mockResolvedValueOnce(activeLot).mockResolvedValueOnce(cancelledLot);
    const deps = baseDeps({
      adminReviewTaskRepository: makeAdminReviewTaskRepo({
        findPendingLotWithdrawal: vi.fn().mockResolvedValue({ id: "task-1" }),
        resolveLotWithdrawal,
      }) as never,
      lotRepo: {
        findById,
        updateStatus: vi.fn().mockResolvedValue(undefined),
      } as unknown as ILotRepository,
    });

    const result = await approveWithdrawalRequest(deps, "admin-1", "staff", "lot-1", "super_admin");
    expect(result.isOk()).toBe(true);
    expect(resolveLotWithdrawal).toHaveBeenCalled();
  });
});
