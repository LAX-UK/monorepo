import type { Database } from "@auction/db";
import type { ItemSubmission, Lot } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IItemSubmissionRepository, IUserRepository } from "./interfaces/repositories.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";

const hoisted = vi.hoisted(() => ({
  txSubFindById: vi.fn(),
  txSubUpdate: vi.fn(),
  txLotCreate: vi.fn(),
}));

vi.mock("../repositories/drizzle-item-submission.repository.js", () => {
  class DrizzleItemSubmissionRepository {
    findById = hoisted.txSubFindById;
    update = hoisted.txSubUpdate;
    create = vi.fn();
  }
  return { DrizzleItemSubmissionRepository };
});

vi.mock("../repositories/drizzle-lot.repository.js", () => {
  class DrizzleLotRepository {
    create = hoisted.txLotCreate;
  }
  return { DrizzleLotRepository };
});

import { ItemSubmissionService } from "./item-submission.service.js";

const catId = "c1000001-0000-4000-8000-000000000001";

const stubDb = {} as unknown as Database;

function mkSubmission(
  partial: Partial<ItemSubmission> & Pick<ItemSubmission, "id" | "status">,
): ItemSubmission {
  return {
    sellerId: "seller-1",
    legalEntityId: "seller-entity-1",
    title: "Work",
    description: "Desc",
    medium: null,
    dimensions: null,
    images: [],
    askingPrice: "100.00",
    reservePrice: null,
    categoryId: catId,
    submitterNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReason: null,
    convertedLotId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("ItemSubmissionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createDraft persists via repository", async () => {
    const created = mkSubmission({ id: "sub-1", status: "draft" });
    const submissions: IItemSubmissionRepository = {
      create: vi.fn().mockResolvedValue(created),
    } as unknown as IItemSubmissionRepository;
    const users = {} as unknown as IUserRepository;
    const dispatcher = { dispatch: vi.fn() } as unknown as NotificationDispatcher;
    const svc = new ItemSubmissionService(stubDb, submissions, users, dispatcher);
    const r = await svc.createDraft("seller-1", {
      title: "Work",
      categoryId: catId,
    });
    expect(r.isOk()).toBe(true);
    expect(submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Work", legalEntityId: "seller-1" }),
    );
  });

  it("createDraft allows individual entity in lead verification state", async () => {
    const created = mkSubmission({ id: "sub-1", status: "draft" });
    const submissions: IItemSubmissionRepository = {
      create: vi.fn().mockResolvedValue(created),
    } as unknown as IItemSubmissionRepository;
    const legalEntityRepository: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue({ kind: "individual", status: "lead" }),
    } as unknown as ILegalEntityRepository;
    const dispatcher = { dispatch: vi.fn() } as unknown as NotificationDispatcher;
    const svc = new ItemSubmissionService(
      stubDb,
      submissions,
      {} as IUserRepository,
      dispatcher,
      undefined,
      null,
      legalEntityRepository,
      null,
    );
    const r = await svc.createDraft("ent-1", {
      title: "Work",
      categoryId: catId,
    });
    expect(r.isOk()).toBe(true);
  });

  it("createDraft still blocks organisation entity before approved or restricted", async () => {
    const submissions: IItemSubmissionRepository = {
      create: vi.fn(),
    } as unknown as IItemSubmissionRepository;
    const legalEntityRepository: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue({ kind: "organisation", status: "lead" }),
    } as unknown as ILegalEntityRepository;
    const dispatcher = { dispatch: vi.fn() } as unknown as NotificationDispatcher;
    const svc = new ItemSubmissionService(
      stubDb,
      submissions,
      {} as IUserRepository,
      dispatcher,
      undefined,
      null,
      legalEntityRepository,
      null,
    );
    const r = await svc.createDraft("ent-1", {
      title: "Work",
      categoryId: catId,
    });
    expect(r.isErr()).toBe(true);
    expect(submissions.create).not.toHaveBeenCalled();
  });

  it("submitForReview notifies admins", async () => {
    const draft = mkSubmission({ id: "sub-1", status: "draft", legalEntityId: "u1" });
    const submitted = { ...draft, status: "submitted" as const };
    const submissions: IItemSubmissionRepository = {
      findById: vi.fn().mockResolvedValue(draft),
      update: vi.fn().mockResolvedValue(submitted),
    } as unknown as IItemSubmissionRepository;
    const users: IUserRepository = {
      listIdsByRole: vi.fn().mockResolvedValue(["admin-a", "admin-b"]),
    } as unknown as IUserRepository;
    const dispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationDispatcher;
    const svc = new ItemSubmissionService(stubDb, submissions, users, dispatcher);
    const r = await svc.submitForReview("u1", "sub-1");
    expect(r.isOk()).toBe(true);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "admin-a",
      expect.objectContaining({ type: "submission_received_for_review" }),
    );
  });

  it("approve creates lot with submitter sellerId and marks converted", async () => {
    const under = mkSubmission({
      id: "sub-1",
      status: "under_review",
      sellerId: "alice",
      legalEntityId: "00000000-0000-4000-8000-000000000010",
      title: "Blue Study",
    });
    const createdLot: Lot = {
      id: "lot-new",
      saleId: null,
      lotNumber: null,
      sellerId: "alice",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000010",
      title: "Blue Study",
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
      startTime: new Date(),
      endTime: new Date(),
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };
    const convertedSubmission = {
      ...under,
      status: "converted" as const,
      convertedLotId: createdLot.id,
      reviewedBy: "admin-1",
      reviewedAt: new Date(),
      reviewNotes: "Nice work",
      rejectionReason: null,
    };

    hoisted.txSubFindById.mockResolvedValue(under);
    hoisted.txLotCreate.mockResolvedValue(createdLot);
    hoisted.txSubUpdate.mockResolvedValue(convertedSubmission);

    const db = {
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    } as unknown as Database;

    const dispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationDispatcher;
    const legalEntityRecipients: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue(["owner-1", "consignor-1"]),
    };

    const svc = new ItemSubmissionService(
      db,
      {} as IItemSubmissionRepository,
      {} as unknown as IUserRepository,
      dispatcher,
      undefined,
      legalEntityRecipients,
    );
    const r = await svc.approve("admin-1", "sub-1", { reviewNotes: "Nice work" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.lot.sellerLegalEntityId).toBe(under.legalEntityId);
      expect(r.value.submission.status).toBe("converted");
      expect(r.value.submission.convertedLotId).toBe("lot-new");
    }
    expect(hoisted.txLotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Blue Study",
        sellerLegalEntityId: under.legalEntityId,
        categoryIds: [catId],
        auctionType: "english",
        artistId: null,
      }),
    );
    expect(legalEntityRecipients.listUserIdsForAudience).toHaveBeenCalledWith(
      under.legalEntityId,
      "seller",
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({ type: "submission_approved", lotId: "lot-new" }),
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "consignor-1",
      expect.objectContaining({ type: "submission_approved", lotId: "lot-new" }),
    );
  });

  it("approve passes a pre-existing artistId straight through to the lot mapper", async () => {
    const under = mkSubmission({
      id: "sub-2",
      status: "under_review",
      legalEntityId: "00000000-0000-4000-8000-000000000010",
      title: "Marcia Lot",
    });
    const createdLot: Lot = {
      id: "lot-marcia",
      saleId: null,
      lotNumber: null,
      sellerLegalEntityId: under.legalEntityId,
      title: under.title,
      description: null,
      medium: null,
      dimensions: null,
      images: [],
      categoryId: catId,
      auctionType: "english",
      startingPrice: "50.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "50.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(),
      endTime: new Date(),
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };
    hoisted.txSubFindById.mockResolvedValue(under);
    hoisted.txLotCreate.mockResolvedValue(createdLot);
    hoisted.txSubUpdate.mockResolvedValue({
      ...under,
      status: "converted" as const,
      convertedLotId: createdLot.id,
    });

    const db = {
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    } as unknown as Database;
    const dispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationDispatcher;
    const legalEntityRecipients: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue([]),
    };

    const svc = new ItemSubmissionService(
      db,
      {} as IItemSubmissionRepository,
      {} as unknown as IUserRepository,
      dispatcher,
      undefined,
      legalEntityRecipients,
    );

    const ARTIST_ID = "11111111-2222-4333-8444-555555555555";
    const r = await svc.approve("admin-1", "sub-2", { artistId: ARTIST_ID });
    expect(r.isOk()).toBe(true);
    expect(hoisted.txLotCreate).toHaveBeenCalledWith(
      expect.objectContaining({ artistId: ARTIST_ID }),
    );
  });

  it("approve rejects when both artistId and newArtist are supplied", async () => {
    const under = mkSubmission({
      id: "sub-3",
      status: "under_review",
      legalEntityId: "00000000-0000-4000-8000-000000000010",
    });
    hoisted.txSubFindById.mockResolvedValue(under);

    const db = {
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    } as unknown as Database;
    const svc = new ItemSubmissionService(
      db,
      {} as IItemSubmissionRepository,
      {} as unknown as IUserRepository,
      { dispatch: vi.fn() } as unknown as NotificationDispatcher,
    );
    const r = await svc.approve("admin-1", "sub-3", {
      artistId: "11111111-2222-4333-8444-555555555555",
      newArtist: { displayName: "Inline" },
    });
    expect(r.isErr()).toBe(true);
    expect(hoisted.txLotCreate).not.toHaveBeenCalled();
  });

  it("reject stores reason and notifies seller", async () => {
    const under = mkSubmission({
      id: "sub-1",
      status: "under_review",
      sellerId: "bob",
      legalEntityId: "00000000-0000-4000-8000-000000000010",
    });
    const rejected = {
      ...under,
      status: "rejected" as const,
      rejectionReason: "Not suitable",
      reviewedBy: "admin-1",
      reviewedAt: new Date(),
    };
    const submissions: IItemSubmissionRepository = {
      findById: vi.fn().mockResolvedValue(under),
      update: vi.fn().mockResolvedValue(rejected),
    } as unknown as IItemSubmissionRepository;
    const dispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationDispatcher;
    const legalEntityRecipients: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue(["admin-entity-1"]),
    };
    const svc = new ItemSubmissionService(
      stubDb,
      submissions,
      {} as unknown as IUserRepository,
      dispatcher,
      undefined,
      legalEntityRecipients,
    );
    const r = await svc.reject("admin-1", "sub-1", "Not suitable", "See policy");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.rejectionReason).toBe("Not suitable");
    }
    expect(legalEntityRecipients.listUserIdsForAudience).toHaveBeenCalledWith(
      under.legalEntityId,
      "seller",
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "admin-entity-1",
      expect.objectContaining({ type: "submission_rejected" }),
    );
  });

  it("enforces ownership on getForSeller", async () => {
    const submissions: IItemSubmissionRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(mkSubmission({ id: "s1", status: "draft", legalEntityId: "alice" })),
    } as unknown as IItemSubmissionRepository;
    const svc = new ItemSubmissionService(
      stubDb,
      submissions,
      {} as unknown as IUserRepository,
      {} as NotificationDispatcher,
    );
    const ok = await svc.getForSeller("alice", "s1");
    const bad = await svc.getForSeller("other", "s1");
    expect(ok.isOk()).toBe(true);
    expect(bad.isErr()).toBe(true);
  });

  it("bulkApproveOrReject rejects when reject op missing reason", async () => {
    const svc = new ItemSubmissionService(
      stubDb,
      {} as unknown as IItemSubmissionRepository,
      {} as unknown as IUserRepository,
      {} as NotificationDispatcher,
    );
    const r = await svc.bulkApproveOrReject({
      adminId: "a1",
      ids: ["s1"],
      op: "reject",
      reason: "   ",
      reviewNotes: undefined,
    });
    expect(r.kind).toBe("bad_request");
  });

  it("getSubmissionForViewerApi uses admin path when role is platform admin", async () => {
    const row = mkSubmission({ id: "s1", status: "draft", legalEntityId: "ent-1" });
    const submissions: IItemSubmissionRepository = {
      findById: vi.fn().mockResolvedValue(row),
    } as unknown as IItemSubmissionRepository;
    const svc = new ItemSubmissionService(
      stubDb,
      submissions,
      {} as unknown as IUserRepository,
      {} as NotificationDispatcher,
    );
    const r = await svc.getSubmissionForViewerApi({
      submissionId: "s1",
      role: "administrator",
      sellerLegalEntityId: "wrong-entity",
    });
    expect(r.isOk()).toBe(true);
  });
});
