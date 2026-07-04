import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type { ItemSubmission, Lot } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LotLifecycleRecording } from "../lot-lifecycle-recording.service.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import { convert } from "./submission-convert-to-lot.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

const catId = "c1000001-0000-4000-8000-000000000001";

const hoisted = vi.hoisted(() => ({
  txSubFindById: vi.fn(),
  txSubUpdate: vi.fn(),
  txLotCreate: vi.fn(),
  forTransaction: vi.fn(),
  recordCreated: vi.fn(),
}));

function mkApprovedSubmission(
  partial: Partial<ItemSubmission> & Pick<ItemSubmission, "id">,
): ItemSubmission {
  return {
    sellerId: "seller-1",
    legalEntityId: "le-1",
    title: "Original title",
    status: "approved",
    description: "Desc",
    medium: null,
    dimensions: null,
    images: ["https://example.com/photo.jpg"],
    askingPrice: "100.00",
    reservePrice: null,
    categoryId: catId,
    submitterNotes: null,
    reviewedBy: "admin-1",
    reviewedAt: new Date(),
    reviewNotes: null,
    rejectionReason: null,
    convertedLotId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

function mkCreatedLot(partial: Partial<Lot> & Pick<Lot, "id">): Lot {
  const startTime = new Date("2026-01-01T12:00:00Z");
  const endTime = new Date("2026-01-02T12:00:00Z");
  return {
    saleId: null,
    lotNumber: null,
    sellerLegalEntityId: "le-1",
    title: "Original title",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: catId,
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime,
    endTime,
    status: "draft",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...partial,
  };
}

function testRepoFactory(): IRepositoryFactory {
  const txSubRepo = {
    findById: hoisted.txSubFindById,
    update: hoisted.txSubUpdate,
  };
  const txLotRepo = { create: hoisted.txLotCreate };
  const conn = { lot: txLotRepo, itemSubmission: txSubRepo };
  hoisted.forTransaction.mockReturnValue(conn);
  return {
    forTransaction: hoisted.forTransaction,
  } as unknown as IRepositoryFactory;
}

function baseDeps(overrides: Partial<ItemSubmissionServiceDeps> = {}): ItemSubmissionServiceDeps {
  return {
    transactionRunner: {
      runInTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    } as never,
    submissions: {} as never,
    users: {} as never,
    dispatcher: {
      dispatch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationDispatcher,
    imageCleanup: undefined,
    legalEntityNotificationRecipients: null,
    legalEntityRepository: null,
    domainEventSink: null,
    mediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    lotLifecycleRecording: {
      recordCreated: hoisted.recordCreated.mockResolvedValue(undefined),
    } as unknown as LotLifecycleRecording,
    repoFactory: testRepoFactory(),
    ...overrides,
  };
}

describe("convert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.forTransaction.mockImplementation(() => ({
      itemSubmission: { findById: hoisted.txSubFindById, update: hoisted.txSubUpdate },
      lot: { create: hoisted.txLotCreate },
    }));
  });

  it("uses forTransaction for both submission and lot repos", async () => {
    const submission = mkApprovedSubmission({ id: "sub-1" });
    const createdLot = mkCreatedLot({ id: "lot-1", title: submission.title });
    hoisted.txSubFindById.mockResolvedValue(submission);
    hoisted.txLotCreate.mockResolvedValue(createdLot);
    hoisted.txSubUpdate.mockResolvedValue({
      ...submission,
      status: "converted",
      convertedLotId: createdLot.id,
    });

    await convert(baseDeps(), "admin-1", "sub-1");

    expect(hoisted.forTransaction).toHaveBeenCalledTimes(2);
  });

  it("omits reviewNotes from update when empty", async () => {
    const submission = mkApprovedSubmission({ id: "sub-1" });
    const createdLot = mkCreatedLot({ id: "lot-1", title: submission.title });
    hoisted.txSubFindById.mockResolvedValue(submission);
    hoisted.txLotCreate.mockResolvedValue(createdLot);
    hoisted.txSubUpdate.mockResolvedValue({
      ...submission,
      status: "converted",
      convertedLotId: createdLot.id,
    });

    await convert(baseDeps(), "admin-1", "sub-1", { reviewNotes: "   " });

    expect(hoisted.txSubUpdate).toHaveBeenCalledWith(
      "sub-1",
      expect.not.objectContaining({ reviewNotes: expect.anything() }),
    );
  });

  it("passes actorUserId to lotLifecycleRecording.recordCreated", async () => {
    const submission = mkApprovedSubmission({ id: "sub-1" });
    const createdLot = mkCreatedLot({ id: "lot-1", title: submission.title });
    hoisted.txSubFindById.mockResolvedValue(submission);
    hoisted.txLotCreate.mockResolvedValue(createdLot);
    hoisted.txSubUpdate.mockResolvedValue({
      ...submission,
      status: "converted",
      convertedLotId: createdLot.id,
    });

    await convert(baseDeps(), "admin-1", "sub-1");

    expect(hoisted.recordCreated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: "submission",
        actorUserId: "admin-1",
      }),
    );
  });

  it("notifies seller using pre-conversion title", async () => {
    const submission = mkApprovedSubmission({ id: "sub-1", title: "Original title" });
    const createdLot = mkCreatedLot({ id: "lot-1", title: "Updated title" });
    hoisted.txSubFindById.mockResolvedValue(submission);
    hoisted.txLotCreate.mockResolvedValue(createdLot);
    hoisted.txSubUpdate.mockResolvedValue({
      ...submission,
      status: "converted",
      title: "Updated title",
      convertedLotId: createdLot.id,
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue(["seller-user-1"]),
    };

    await convert(
      baseDeps({
        dispatcher: { dispatch } as unknown as NotificationDispatcher,
        legalEntityNotificationRecipients,
      }),
      "admin-1",
      "sub-1",
    );

    expect(dispatch).toHaveBeenCalledWith(
      "seller-user-1",
      expect.objectContaining({
        type: "submission_converted",
        message: expect.stringContaining("Original title"),
      }),
    );
  });

  it("rejects when both artistId and newArtist are supplied", async () => {
    const result = await convert(baseDeps(), "admin-1", "sub-1", {
      artistId: "artist-1",
      newArtist: { displayName: "New Artist" },
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("not both");
  });
});
