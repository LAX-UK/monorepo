import type { Database } from "@auction/db";
import type {
  CreateItemSubmissionInput,
  ItemSubmission,
  Lot,
  UpdateItemSubmissionInput,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../lib/errors.js";
import { DrizzleItemSubmissionRepository } from "../repositories/drizzle-item-submission.repository.js";
import { DrizzleLotRepository } from "../repositories/drizzle-lot.repository.js";
import type {
  IItemSubmissionService,
  UpdateSubmissionActorInput,
} from "./interfaces/item-submission-service.js";
import type {
  IItemSubmissionRepository,
  ILotRepository,
  IUserRepository,
  ItemSubmissionUpdatePatch,
  ListSubmissionsFilter,
} from "./interfaces/repositories.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import { submissionToCreateLotInput } from "./submission-to-lot.mapper.js";

export class ItemSubmissionService implements IItemSubmissionService {
  constructor(
    private readonly db: Database,
    private readonly submissions: IItemSubmissionRepository,
    private readonly lots: ILotRepository,
    private readonly users: IUserRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async createDraft(
    sellerId: string,
    input: CreateItemSubmissionInput,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const row = await this.submissions.create(sellerId, input);
    return ok(row);
  }

  async updateForActor(
    input: UpdateSubmissionActorInput,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const { actorId, role, submissionId, sellerPatch, adminNotes } = input;
    const s = await this.submissions.findById(submissionId);
    if (!s) return err(new SubmissionError("Not found", 404));

    if (role === "admin") {
      if (!adminNotes) {
        return err(new SubmissionError("Invalid update body", 400));
      }
      if (s.status !== "submitted" && s.status !== "under_review") {
        return err(
          new SubmissionError("Admin notes are only allowed while submitted or under review"),
        );
      }
      const updated = await this.submissions.update(submissionId, {
        reviewNotes: adminNotes.reviewNotes ?? null,
      });
      return ok(updated);
    }

    if (s.sellerId !== actorId) {
      return err(new SubmissionError("Not found", 404));
    }
    if (s.status !== "draft") {
      return err(new SubmissionError("Only draft submissions can be edited"));
    }
    if (!sellerPatch) {
      return err(new SubmissionError("Invalid update body", 400));
    }
    const patch = sellerPatchToRepoPatch(sellerPatch);
    const updated = await this.submissions.update(submissionId, patch);
    return ok(updated);
  }

  async submitForReview(
    sellerId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s || s.sellerId !== sellerId) return err(new SubmissionError("Not found", 404));
    if (s.status !== "draft") {
      return err(new SubmissionError("Only drafts can be submitted for review"));
    }
    const updated = await this.submissions.update(id, { status: "submitted" });
    const admins = await this.users.listIdsByRole("admin");
    for (const aid of admins) {
      await this.dispatcher.dispatch(aid, {
        type: "submission_received_for_review",
        title: "New item submission",
        message: `A seller submitted "${updated.title}" for review.`,
      });
    }
    return ok(updated);
  }

  async withdraw(sellerId: string, id: string): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s || s.sellerId !== sellerId) return err(new SubmissionError("Not found", 404));
    if (s.status !== "draft" && s.status !== "submitted") {
      return err(new SubmissionError("This submission cannot be withdrawn"));
    }
    const updated = await this.submissions.update(id, { status: "withdrawn" });
    return ok(updated);
  }

  async listForSeller(sellerId: string, f: ListSubmissionsFilter): Promise<ItemSubmission[]> {
    return this.submissions.listForSeller(sellerId, f);
  }

  async getForSeller(
    sellerId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s || s.sellerId !== sellerId) return err(new SubmissionError("Not found", 404));
    return ok(s);
  }

  async listForAdmin(f: ListSubmissionsFilter): Promise<ItemSubmission[]> {
    return this.submissions.listForAdmin(f);
  }

  async getForAdmin(id: string): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s) return err(new SubmissionError("Not found", 404));
    return ok(s);
  }

  async countPendingForAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number> {
    return this.submissions.countAdmin(f);
  }

  async startReview(
    _adminId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s) return err(new SubmissionError("Not found", 404));
    if (s.status !== "submitted") {
      return err(new SubmissionError("Only submitted items can move to review"));
    }
    const updated = await this.submissions.update(id, { status: "under_review" });
    return ok(updated);
  }

  async approve(
    adminId: string,
    id: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>> {
    try {
      const { lot, submission, sellerId, title } = await this.db.transaction(async (tx) => {
        const subRepo = new DrizzleItemSubmissionRepository(tx);
        const lotRepo = new DrizzleLotRepository(tx);
        const s = await subRepo.findById(id);
        if (!s) {
          throw new SubmissionError("Not found", 404);
        }
        if (s.status !== "under_review") {
          throw new SubmissionError("Submission must be under review to approve");
        }
        const lotInput = submissionToCreateLotInput(s);
        const createdLot = await lotRepo.create(s.sellerId, lotInput);
        const submission = await subRepo.update(id, {
          status: "converted",
          convertedLotId: createdLot.id,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes ?? null,
          rejectionReason: null,
        });
        return { lot: createdLot, submission, sellerId: s.sellerId, title: s.title };
      });
      await this.dispatcher.dispatch(sellerId, {
        type: "submission_approved",
        title: "Submission approved",
        message: `Your submission "${title}" was approved. A draft lot was created for cataloguing.`,
        lotId: lot.id,
      });
      return ok({ submission, lot });
    } catch (e) {
      if (e instanceof SubmissionError) {
        return err(e);
      }
      throw e;
    }
  }

  async reject(
    adminId: string,
    id: string,
    rejectionReason: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s) return err(new SubmissionError("Not found", 404));
    if (s.status !== "under_review") {
      return err(new SubmissionError("Submission must be under review to reject"));
    }
    const updated = await this.submissions.update(id, {
      status: "rejected",
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes ?? null,
      rejectionReason,
    });
    await this.dispatcher.dispatch(s.sellerId, {
      type: "submission_rejected",
      title: "Submission not accepted",
      message: `Your submission "${s.title}" was not accepted: ${rejectionReason}`,
    });
    return ok(updated);
  }
}

function sellerPatchToRepoPatch(patch: UpdateItemSubmissionInput): ItemSubmissionUpdatePatch {
  const out: ItemSubmissionUpdatePatch = {};
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.description !== undefined) out.description = patch.description ?? null;
  if (patch.medium !== undefined) out.medium = patch.medium ?? null;
  if (patch.dimensions !== undefined) out.dimensions = patch.dimensions ?? null;
  if (patch.images !== undefined) out.images = patch.images;
  if (patch.askingPrice !== undefined) out.askingPrice = patch.askingPrice ?? null;
  if (patch.reservePrice !== undefined) out.reservePrice = patch.reservePrice ?? null;
  if (patch.categoryId !== undefined) out.categoryId = patch.categoryId;
  if (patch.submitterNotes !== undefined) out.submitterNotes = patch.submitterNotes ?? null;
  return out;
}
