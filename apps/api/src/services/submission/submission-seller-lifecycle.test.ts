import type {
  IItemSubmissionRepository,
  ILegalEntityRepository,
} from "@auction/persistence/interfaces";
import type { ItemSubmission } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import { submitForReview, updateForActor, withdraw } from "./submission-seller-lifecycle.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

const catId = "c1000001-0000-4000-8000-000000000001";

function submission(status: ItemSubmission["status"]): ItemSubmission {
  return {
    id: "sub-1",
    legalEntityId: "le-1",
    title: "Untitled (Blue)",
    description: "Oil on canvas",
    medium: null,
    dimensions: null,
    images: ["https://example.com/front.jpg"],
    askingPrice: null,
    reservePrice: null,
    categoryId: catId,
    categoryIds: [catId],
    submitterNotes: null,
    status,
    reviewedBy: "admin-1",
    reviewedAt: new Date(),
    reviewNotes: null,
    rejectionReason: null,
    changesRequestedNote: status === "changes_requested" ? "Add a photo of the back." : null,
    convertedLotId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function deps(
  current: ItemSubmission,
  entity: { kind: "individual" | "organisation"; status: string } = {
    kind: "individual",
    status: "approved",
  },
) {
  const update = vi.fn(async (_id: string, patch: Partial<ItemSubmission>) => ({
    ...current,
    ...patch,
  }));
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(undefined);
  const value: ItemSubmissionServiceDeps = {
    transactionRunner: {} as never,
    submissions: {
      findById: vi.fn().mockResolvedValue(current),
      update,
    } as unknown as IItemSubmissionRepository,
    users: {
      listStaffIdsForSubmissionNotifications: vi.fn().mockResolvedValue(["staff-1"]),
    } as never,
    dispatcher: { dispatch } as unknown as NotificationDispatcher,
    imageCleanup: undefined,
    legalEntityNotificationRecipients: null,
    legalEntityRepository: {
      findById: vi.fn().mockResolvedValue(entity),
    } as unknown as ILegalEntityRepository,
    domainEventSink: { publish } as never,
    mediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    lotLifecycleRecording: null,
    repoFactory: null,
    consignmentAgreements: null,
    sellerIdentity: null,
    staffRoles: null,
  };
  return { value, update, dispatch, publish };
}

describe("needs changes: the seller edits the same submission and resubmits", () => {
  it("lets the seller edit a submission that needs changes", async () => {
    const d = deps(submission("changes_requested"));
    const result = await updateForActor(d.value, {
      actorId: "le-1",
      role: "client",
      submissionId: "sub-1",
      sellerPatch: { description: "Oil on canvas, signed on the back" },
    });
    expect(result.isOk()).toBe(true);
    expect(d.update).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ description: "Oil on canvas, signed on the back" }),
    );
  });

  it("still refuses edits once the work is with the specialist", async () => {
    const d = deps(submission("under_review"));
    const result = await updateForActor(d.value, {
      actorId: "le-1",
      role: "client",
      submissionId: "sub-1",
      sellerPatch: { title: "New" },
    });
    expect(result.isErr()).toBe(true);
  });

  it("resubmits to the review queue, records it and tells staff", async () => {
    const d = deps(submission("changes_requested"));
    const result = await submitForReview(d.value, "le-1", "sub-1");
    expect(result.isOk()).toBe(true);
    expect(d.update).toHaveBeenCalledWith("sub-1", { status: "submitted" });
    expect(d.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "submission.resubmitted", aggregateId: "sub-1" }),
    );
    expect(d.dispatch).toHaveBeenCalledWith(
      "staff-1",
      expect.objectContaining({ title: "Submission sent back with changes" }),
    );
  });

  it("submits a draft without recording a resubmission", async () => {
    const d = deps(submission("draft"));
    await submitForReview(d.value, "le-1", "sub-1");
    expect(d.publish).not.toHaveBeenCalled();
  });

  it("keeps the original sender when someone else sends it back", async () => {
    const d = deps({ ...submission("changes_requested"), submittedByUserId: "consignor-1" });
    await submitForReview(d.value, "le-1", "sub-1", "admin-1");
    expect(d.update).toHaveBeenCalledWith("sub-1", { status: "submitted" });
  });

  it("records the sender on a first submission that has none yet", async () => {
    const d = deps({ ...submission("draft"), submittedByUserId: null });
    await submitForReview(d.value, "le-1", "sub-1", "consignor-1");
    expect(d.update).toHaveBeenCalledWith("sub-1", {
      status: "submitted",
      submittedByUserId: "consignor-1",
    });
  });

  it("lets the seller withdraw instead", async () => {
    const d = deps(submission("changes_requested"));
    expect((await withdraw(d.value, "le-1", "sub-1")).isOk()).toBe(true);
  });
});

describe("an organisation under review", () => {
  const underReview = { kind: "organisation" as const, status: "under_review" };

  it("can save drafts", async () => {
    const d = deps(submission("draft"), underReview);
    const result = await updateForActor(d.value, {
      actorId: "le-1",
      role: "client",
      submissionId: "sub-1",
      sellerPatch: { title: "Draft title" },
    });
    expect(result.isOk()).toBe(true);
  });

  it("cannot submit, and is told why", async () => {
    const d = deps(submission("draft"), underReview);
    const result = await submitForReview(d.value, "le-1", "sub-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(403);
    expect(result._unsafeUnwrapErr().message).toMatch(/save the work as a draft/);
    expect(d.update).not.toHaveBeenCalled();
  });
});
