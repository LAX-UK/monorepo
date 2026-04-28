import type { Database } from "@auction/db";
import type { ItemSubmission, Lot } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IItemSubmissionRepository,
  ILotRepository,
  IUserRepository,
} from "./interfaces/repositories.js";
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
    const lots = {} as unknown as ILotRepository;
    const users = {} as unknown as IUserRepository;
    const dispatcher = { dispatch: vi.fn() } as unknown as NotificationDispatcher;
    const svc = new ItemSubmissionService(stubDb, submissions, lots, users, dispatcher);
    const r = await svc.createDraft("seller-1", {
      title: "Work",
      categoryId: catId,
    });
    expect(r.isOk()).toBe(true);
    expect(submissions.create).toHaveBeenCalledWith(
      "seller-1",
      expect.objectContaining({ title: "Work" }),
    );
  });

  it("submitForReview notifies admins", async () => {
    const draft = mkSubmission({ id: "sub-1", status: "draft", sellerId: "u1" });
    const submitted = { ...draft, status: "submitted" as const };
    const submissions: IItemSubmissionRepository = {
      findById: vi.fn().mockResolvedValue(draft),
      update: vi.fn().mockResolvedValue(submitted),
    } as unknown as IItemSubmissionRepository;
    const users: IUserRepository = {
      listIdsByRole: vi.fn().mockResolvedValue(["admin-a", "admin-b"]),
      updateRoleById: vi.fn().mockResolvedValue(undefined),
    } as unknown as IUserRepository;
    const dispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationDispatcher;
    const svc = new ItemSubmissionService(stubDb, submissions, {} as ILotRepository, users, dispatcher);
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
      title: "Blue Study",
    });
    const createdLot: Lot = {
      id: "lot-new",
      saleId: null,
      lotNumber: null,
      sellerId: "alice",
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

    const svc = new ItemSubmissionService(
      db,
      {} as IItemSubmissionRepository,
      {} as ILotRepository,
      {} as unknown as IUserRepository,
      dispatcher,
    );
    const r = await svc.approve("admin-1", "sub-1", "Nice work");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.lot.sellerId).toBe("alice");
      expect(r.value.submission.status).toBe("converted");
      expect(r.value.submission.convertedLotId).toBe("lot-new");
    }
    expect(hoisted.txLotCreate).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({
        title: "Blue Study",
        categoryId: catId,
        auctionType: "english",
      }),
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ type: "submission_approved", lotId: "lot-new" }),
    );
  });

  it("reject stores reason and notifies seller", async () => {
    const under = mkSubmission({ id: "sub-1", status: "under_review", sellerId: "bob" });
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
    const svc = new ItemSubmissionService(
      stubDb,
      submissions,
      {} as ILotRepository,
      {} as unknown as IUserRepository,
      dispatcher,
    );
    const r = await svc.reject("admin-1", "sub-1", "Not suitable", "See policy");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.rejectionReason).toBe("Not suitable");
    }
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "bob",
      expect.objectContaining({ type: "submission_rejected" }),
    );
  });

  it("enforces ownership on getForSeller", async () => {
    const submissions: IItemSubmissionRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(mkSubmission({ id: "s1", status: "draft", sellerId: "alice" })),
    } as unknown as IItemSubmissionRepository;
    const svc = new ItemSubmissionService(
      stubDb,
      submissions,
      {} as ILotRepository,
      {} as unknown as IUserRepository,
      {} as NotificationDispatcher,
    );
    const ok = await svc.getForSeller("alice", "s1");
    const bad = await svc.getForSeller("other", "s1");
    expect(ok.isOk()).toBe(true);
    expect(bad.isErr()).toBe(true);
  });
});
