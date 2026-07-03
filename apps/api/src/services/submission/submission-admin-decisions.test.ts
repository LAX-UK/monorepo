import type { ItemSubmission } from "@auction/types";
import { err } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { SubmissionError } from "../../lib/errors.js";
import type { ILegalEntityNotificationRecipientReader } from "../interfaces/legal-entity-notification-recipients.js";
import type { IItemSubmissionRepository } from "../interfaces/repositories.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import { accept, approve, bulkApproveOrReject, reject } from "./submission-admin-decisions.js";
import { convert } from "./submission-convert-to-lot.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

vi.mock("./submission-convert-to-lot.js", () => ({
  convert: vi.fn(),
}));

const catId = "c1000001-0000-4000-8000-000000000001";

function qualityPassingSubmission(
  partial: Partial<ItemSubmission> & Pick<ItemSubmission, "id" | "status">,
): ItemSubmission {
  return {
    sellerId: "seller-1",
    legalEntityId: "le-1",
    title: "Pre-update title",
    description: "Desc",
    medium: null,
    dimensions: null,
    images: ["https://example.com/photo.jpg"],
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

const underReview = qualityPassingSubmission({ id: "sub-1", status: "under_review" });
const approved = qualityPassingSubmission({ id: "sub-1", status: "approved" });

function baseDeps(overrides: Partial<ItemSubmissionServiceDeps> = {}): ItemSubmissionServiceDeps {
  return {
    transactionRunner: {
      runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
    } as never,
    submissions: {} as never,
    users: {} as never,
    dispatcher: {
      dispatch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationDispatcher,
    imageCleanup: undefined,
    legalEntityNotificationRecipients: null,
    legalEntityRepository: null,
    domainEventPublisher: null,
    domainEventSink: null,
    mediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    lotLifecycleRecording: null,
    repoFactory: null,
    ...overrides,
  };
}

describe("approve", () => {
  it("calls accept with notifySeller false then convert for under_review", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const findById = vi.fn().mockResolvedValue(underReview);
    const update = vi.fn().mockResolvedValue(approved);
    vi.mocked(convert).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { submission: approved, lot: { id: "lot-1" } as never, readinessPercent: 80 },
    } as never);
    const legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue(["seller-user-1"]),
    };
    const deps = baseDeps({
      submissions: { findById, update } as unknown as IItemSubmissionRepository,
      dispatcher: { dispatch } as unknown as NotificationDispatcher,
      legalEntityNotificationRecipients,
    });
    const result = await approve(deps, "admin-1", "sub-1", { reviewNotes: "ok" });
    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith("sub-1", expect.objectContaining({ status: "approved" }));
    expect(convert).toHaveBeenCalledWith(deps, "admin-1", "sub-1", { reviewNotes: "ok" });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "submission_approved" }),
    );
  });

  it("skips accept when status is already approved", async () => {
    vi.mocked(convert).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { submission: approved, lot: { id: "lot-1" } as never, readinessPercent: 80 },
    } as never);
    const findById = vi.fn().mockResolvedValue(approved);
    const update = vi.fn();
    const deps = baseDeps({
      submissions: { findById, update } as unknown as IItemSubmissionRepository,
    });
    await approve(deps, "admin-1", "sub-1");
    expect(update).not.toHaveBeenCalled();
    expect(convert).toHaveBeenCalled();
  });

  it("returns err when convert fails after accept succeeded", async () => {
    const findById = vi.fn().mockResolvedValue(underReview);
    const update = vi.fn().mockResolvedValue(approved);
    vi.mocked(convert).mockResolvedValue(err(new SubmissionError("Lot creation failed", 500)));
    const deps = baseDeps({
      submissions: { findById, update } as unknown as IItemSubmissionRepository,
    });
    const result = await approve(deps, "admin-1", "sub-1");
    expect(result.isErr()).toBe(true);
    expect(update).toHaveBeenCalledWith("sub-1", expect.objectContaining({ status: "approved" }));
    expect(convert).toHaveBeenCalled();
  });
});

describe("accept", () => {
  it("sets reviewNotes to null when empty", async () => {
    const update = vi.fn().mockResolvedValue(approved);
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(underReview),
        update,
      } as unknown as IItemSubmissionRepository,
    });
    await accept(deps, "admin-1", "sub-1", { reviewNotes: "   " });
    expect(update).toHaveBeenCalledWith("sub-1", expect.objectContaining({ reviewNotes: null }));
  });

  it("reject notification uses pre-update s.title", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(underReview),
        update: vi.fn().mockResolvedValue({ ...underReview, status: "rejected", title: "New" }),
      } as unknown as IItemSubmissionRepository,
      dispatcher: { dispatch } as unknown as NotificationDispatcher,
      legalEntityNotificationRecipients: null,
    });
    await reject(deps, "admin-1", "sub-1", "Not suitable");
    expect(dispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: expect.stringContaining("Pre-update title"),
      }),
    );
  });
});

describe("bulkApproveOrReject", () => {
  it("approve op calls accept not convert and notifies seller", async () => {
    vi.mocked(convert).mockClear();
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const submission = qualityPassingSubmission({ id: "sub-1", status: "under_review" });
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(submission),
        update: vi.fn().mockResolvedValue(approved),
      } as unknown as IItemSubmissionRepository,
      dispatcher: { dispatch } as unknown as NotificationDispatcher,
      legalEntityNotificationRecipients: null,
    });
    const result = await bulkApproveOrReject(deps, {
      adminId: "admin-1",
      ids: ["sub-1"],
      op: "approve",
    });
    expect(result.kind).toBe("ok");
    expect(convert).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      "le-1",
      expect.objectContaining({ type: "submission_approved" }),
    );
  });

  it("returns bad_request when quality check fails before accept", async () => {
    const submission = qualityPassingSubmission({
      id: "sub-1",
      status: "submitted",
      title: "Incomplete",
      images: [],
    });
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(submission),
      } as unknown as IItemSubmissionRepository,
    });
    const result = await bulkApproveOrReject(deps, {
      adminId: "admin-1",
      ids: ["sub-1"],
      op: "approve",
    });
    expect(result.kind).toBe("bad_request");
    expect(result).toMatchObject({
      message: expect.stringContaining("Incomplete"),
    });
  });
});
