import type { IItemSubmissionRepository } from "@auction/persistence/interfaces";
import type { ItemSubmission } from "@auction/types";
import { err } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { SubmissionError } from "../../lib/errors.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import {
  accept,
  approve,
  bulkApproveOrReject,
  reject,
  requestChanges,
} from "./submission-admin-decisions.js";
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
    domainEventSink: null,
    mediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    lotLifecycleRecording: null,
    repoFactory: null,
    consignmentAgreements: null,
    sellerIdentity: null,
    staffRoles: null,
    ...overrides,
  };
}

describe("approve", () => {
  it("refuses to accept and catalogue in one step, which would skip the seller's agreement", async () => {
    vi.mocked(convert).mockClear();
    const update = vi.fn();
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(underReview),
        update,
      } as unknown as IItemSubmissionRepository,
    });
    const result = await approve(deps, "admin-1", "sub-1", { reviewNotes: "ok" });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(409);
    expect(result._unsafeUnwrapErr().message).toMatch(/consignment agreement/);
    expect(update).not.toHaveBeenCalled();
    expect(convert).not.toHaveBeenCalled();
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

  it("returns err when convert fails", async () => {
    const findById = vi.fn().mockResolvedValue(approved);
    vi.mocked(convert).mockResolvedValue(err(new SubmissionError("Lot creation failed", 500)));
    const deps = baseDeps({
      submissions: { findById, update: vi.fn() } as unknown as IItemSubmissionRepository,
    });
    const result = await approve(deps, "admin-1", "sub-1");
    expect(result.isErr()).toBe(true);
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

describe("accept proposes the consignment agreement", () => {
  it("records the specialist's estimate and terms on the current version", async () => {
    const propose = vi.fn().mockResolvedValue({});
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(underReview),
        update: vi.fn().mockResolvedValue(approved),
      } as unknown as IItemSubmissionRepository,
      consignmentAgreements: { propose } as never,
    });
    await accept(deps, "admin-1", "sub-1", {
      proposal: { estimateLow: "8000", estimateHigh: "12000", commissionPercent: "15" },
    });
    expect(propose).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "sub-1",
        legalEntityId: "le-1",
        termsVersion: "conditions-of-business-part-c-v1",
        estimateLow: "8000",
        estimateHigh: "12000",
        reservePrice: null,
        commissionPercent: "15",
        currency: "GBP",
        proposedByUserId: "admin-1",
      }),
    );
  });

  it("tells the seller to review the agreement", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(underReview),
        update: vi.fn().mockResolvedValue(approved),
      } as unknown as IItemSubmissionRepository,
      dispatcher: { dispatch } as unknown as NotificationDispatcher,
    });
    await accept(deps, "admin-1", "sub-1");
    expect(dispatch).toHaveBeenCalledWith(
      "le-1",
      expect.objectContaining({
        type: "submission_approved",
        message: expect.stringContaining("consignment agreement"),
      }),
    );
  });
});

describe("accept waits for the seller's identity", () => {
  function depsWithIdentity(facts: unknown) {
    const update = vi.fn().mockResolvedValue(approved);
    return {
      update,
      deps: baseDeps({
        submissions: {
          findById: vi.fn().mockResolvedValue(underReview),
          update,
        } as unknown as IItemSubmissionRepository,
        sellerIdentity: { factsFor: vi.fn().mockResolvedValue(facts) },
      }),
    };
  }

  it("refuses with a clear code when the person has not verified their identity", async () => {
    const { deps, update } = depsWithIdentity({ kind: "individual", kycStatus: "pending" });
    const result = await accept(deps, "admin-1", "sub-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatchObject({
      status: 409,
      code: "identity_not_verified",
      message: expect.stringMatching(/hasn't verified their identity/),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses an organisation whose documents are still being checked", async () => {
    const { deps } = depsWithIdentity({ kind: "organisation", status: "under_review" });
    expect((await accept(deps, "admin-1", "sub-1")).isErr()).toBe(true);
  });

  it("accepts once the identity is verified", async () => {
    const { deps, update } = depsWithIdentity({ kind: "individual", kycStatus: "approved" });
    expect((await accept(deps, "admin-1", "sub-1")).isOk()).toBe(true);
    expect(update).toHaveBeenCalled();
  });
});

describe("requestChanges", () => {
  it("moves a reviewed submission to needs changes with the note, and tells the seller", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const publish = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue({ ...underReview, status: "changes_requested" });
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(underReview),
        update,
      } as unknown as IItemSubmissionRepository,
      dispatcher: { dispatch } as unknown as NotificationDispatcher,
      domainEventSink: { publish } as never,
    });
    const result = await requestChanges(deps, "admin-1", "sub-1", "  Add a photo of the back.  ");
    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        status: "changes_requested",
        changesRequestedNote: "Add a photo of the back.",
        reviewedBy: "admin-1",
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "submission.changes_requested" }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      "le-1",
      expect.objectContaining({
        type: "submission_changes_requested",
        message: expect.stringContaining("Add a photo of the back."),
      }),
    );
  });

  it("refuses outside review", async () => {
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(approved),
      } as unknown as IItemSubmissionRepository,
    });
    const result = await requestChanges(deps, "admin-1", "sub-1", "More photos");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/under review/);
  });

  it("refuses an empty note", async () => {
    const deps = baseDeps({
      submissions: {
        findById: vi.fn().mockResolvedValue(underReview),
      } as unknown as IItemSubmissionRepository,
    });
    const result = await requestChanges(deps, "admin-1", "sub-1", "   ");
    expect(result._unsafeUnwrapErr().status).toBe(400);
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
