import type { Database } from "@auction/db";
import type {
  CreateItemSubmissionInput,
  ItemSubmission,
  LegalEntityStatus,
  Lot,
  UpdateItemSubmissionInput,
} from "@auction/types";
import { type UserRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../lib/errors.js";
import { DrizzleItemSubmissionRepository } from "../repositories/drizzle-item-submission.repository.js";
import { DrizzleLotRepository } from "../repositories/drizzle-lot.repository.js";
import { insertArtistInTx } from "./artist-registry.service.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type {
  ApproveSubmissionInput,
  IItemSubmissionService,
  UpdateSubmissionActorInput,
} from "./interfaces/item-submission-service.js";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type {
  IItemSubmissionRepository,
  IUserRepository,
  ItemSubmissionUpdatePatch,
  ListSubmissionsFilter,
} from "./interfaces/repositories.js";
import { resolveLegalEntityNotificationRecipients } from "./legal-entity-notification-routing.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import { submissionToCreateLotInput } from "./submission-to-lot.mapper.js";

const SELLER_ENTITY_WRITE_STATUSES = new Set<LegalEntityStatus>(["approved", "restricted"]);

const INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES = new Set<LegalEntityStatus>(["rejected", "archived"]);

export class ItemSubmissionService implements IItemSubmissionService {
  constructor(
    private readonly db: Database,
    private readonly submissions: IItemSubmissionRepository,
    private readonly users: IUserRepository,
    private readonly dispatcher: NotificationDispatcher,
    private readonly imageCleanup?: ImageCleanupService,
    private readonly legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null = null,
    private readonly legalEntityRepository: ILegalEntityRepository | null = null,
    private readonly domainEventPublisher: DomainEventPublisher | null = null,
  ) {}

  private async assertSellerEntityAllowsSubmissions(
    legalEntityId: string,
  ): Promise<Result<void, SubmissionError>> {
    if (!this.legalEntityRepository) return ok(undefined);
    const e = await this.legalEntityRepository.findById(legalEntityId);
    if (!e) return err(new SubmissionError("Not found", 404));
    if (e.kind === "individual") {
      if (INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES.has(e.status)) {
        return err(
          new SubmissionError(
            "Your account cannot submit items in its current verification state",
            403,
          ),
        );
      }
      return ok(undefined);
    }
    if (!SELLER_ENTITY_WRITE_STATUSES.has(e.status)) {
      return err(
        new SubmissionError(
          "This organisation is not permitted to create or edit submissions in its current verification state",
          403,
        ),
      );
    }
    return ok(undefined);
  }

  private async maybeLogRestrictedSellerWrite(
    legalEntityId: string,
    submissionId: string,
    action: string,
  ): Promise<void> {
    if (!this.legalEntityRepository || !this.domainEventPublisher) return;
    const e = await this.legalEntityRepository.findById(legalEntityId);
    if (e?.status !== "restricted") return;
    await this.domainEventPublisher.publish(this.db, {
      aggregateType: "item_submission",
      aggregateId: submissionId,
      eventType: "item_submission.restricted_entity_write",
      payload: { legalEntityId, submissionId, action },
      actorUserId: null,
      actingLegalEntityId: legalEntityId,
      schemaVersion: 1,
    });
  }

  async createDraft(
    legalEntityId: string,
    input: CreateItemSubmissionInput,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const gate = await this.assertSellerEntityAllowsSubmissions(legalEntityId);
    if (gate.isErr()) return err(gate.error);
    const row = await this.submissions.create({ ...input, legalEntityId });
    await this.maybeLogRestrictedSellerWrite(legalEntityId, row.id, "create_draft");
    return ok(row);
  }

  async updateForActor(
    input: UpdateSubmissionActorInput,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const { actorId, role, submissionId, sellerPatch, adminNotes } = input;
    const s = await this.submissions.findById(submissionId);
    if (!s) return err(new SubmissionError("Not found", 404));

    if (roleHasCapability(role as UserRole, "platform.admin.full")) {
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

    if (s.legalEntityId !== actorId) {
      return err(new SubmissionError("Not found", 404));
    }
    const gate = await this.assertSellerEntityAllowsSubmissions(s.legalEntityId);
    if (gate.isErr()) return err(gate.error);
    if (s.status !== "draft") {
      return err(new SubmissionError("Only draft submissions can be edited"));
    }
    if (!sellerPatch) {
      return err(new SubmissionError("Invalid update body", 400));
    }
    const patch = sellerPatchToRepoPatch(sellerPatch);
    const updated = await this.submissions.update(submissionId, patch);
    await this.maybeLogRestrictedSellerWrite(s.legalEntityId, submissionId, "update_draft");
    if (patch.images !== undefined) {
      await this.imageCleanup?.enqueueRemovedMany(s.images, patch.images);
    }
    return ok(updated);
  }

  async submitForReview(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s || s.legalEntityId !== legalEntityId) return err(new SubmissionError("Not found", 404));
    const gate = await this.assertSellerEntityAllowsSubmissions(legalEntityId);
    if (gate.isErr()) return err(gate.error);
    if (s.status !== "draft") {
      return err(new SubmissionError("Only drafts can be submitted for review"));
    }
    const updated = await this.submissions.update(id, { status: "submitted" });
    await this.maybeLogRestrictedSellerWrite(legalEntityId, id, "submit_for_review");
    const admins = await this.users.listIdsByRole("administrator");
    for (const aid of admins) {
      await this.dispatcher.dispatch(aid, {
        type: "submission_received_for_review",
        title: "New item submission",
        message: `A seller submitted "${updated.title}" for review.`,
      });
    }
    return ok(updated);
  }

  async withdraw(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s || s.legalEntityId !== legalEntityId) return err(new SubmissionError("Not found", 404));
    const gate = await this.assertSellerEntityAllowsSubmissions(legalEntityId);
    if (gate.isErr()) return err(gate.error);
    if (s.status !== "draft" && s.status !== "submitted") {
      return err(new SubmissionError("This submission cannot be withdrawn"));
    }
    const updated = await this.submissions.update(id, { status: "withdrawn" });
    return ok(updated);
  }

  async listForSeller(legalEntityId: string, f: ListSubmissionsFilter): Promise<ItemSubmission[]> {
    return this.submissions.listForLegalEntity(legalEntityId, f);
  }

  async getForSeller(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s || s.legalEntityId !== legalEntityId) return err(new SubmissionError("Not found", 404));
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
    input: ApproveSubmissionInput | undefined = undefined,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>> {
    const reviewNotes = input?.reviewNotes;
    const requestedArtistId = input?.artistId ?? null;
    const newArtist = input?.newArtist;
    if (requestedArtistId && newArtist) {
      return err(new SubmissionError("Provide either artistId or newArtist, not both", 400));
    }
    try {
      const { lot, submission, legalEntityId, title } = await this.db.transaction(async (tx) => {
        const subRepo = new DrizzleItemSubmissionRepository(tx);
        const lotRepo = new DrizzleLotRepository(tx);
        const s = await subRepo.findById(id);
        if (!s) {
          throw new SubmissionError("Not found", 404);
        }
        if (s.status !== "under_review") {
          throw new SubmissionError("Submission must be under review to approve");
        }
        if (!s.legalEntityId) {
          throw new SubmissionError("Legal entity context missing", 400);
        }
        // Admin-driven artist resolution: pick existing, create inline, or
        // leave unattributed. Inline creates default to `approved` because the
        // admin is authoring it directly through their privileged surface.
        let artistId: string | null = requestedArtistId ?? null;
        if (newArtist) {
          const created = await insertArtistInTx(tx, adminId, {
            displayName: newArtist.displayName,
            kind: newArtist.kind ?? "artist",
            shortBio: newArtist.shortBio,
            ownerUserId: newArtist.ownerUserId ?? null,
            status: "approved",
          });
          artistId = created.id;
        }
        const lotInput = submissionToCreateLotInput(s);
        const createdLot = await lotRepo.create({
          ...lotInput,
          sellerLegalEntityId: s.legalEntityId,
          artistId,
        });
        const submission = await subRepo.update(id, {
          status: "converted",
          convertedLotId: createdLot.id,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes ?? null,
          rejectionReason: null,
        });
        return {
          lot: createdLot,
          submission,
          legalEntityId: s.legalEntityId,
          title: s.title,
        };
      });
      const recipients = await resolveLegalEntityNotificationRecipients(
        this.legalEntityNotificationRecipients,
        { legalEntityId, fallbackUserId: legalEntityId, audience: "seller" },
      );
      for (const recipientId of recipients) {
        await this.dispatcher.dispatch(recipientId, {
          type: "submission_approved",
          title: "Submission approved",
          message: `Your submission "${title}" was approved. A draft lot was created for cataloguing.`,
          lotId: lot.id,
        });
      }
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
    if (!s.legalEntityId) {
      return err(new SubmissionError("Legal entity context missing", 400));
    }
    const updated = await this.submissions.update(id, {
      status: "rejected",
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes ?? null,
      rejectionReason,
    });
    const recipients = await resolveLegalEntityNotificationRecipients(
      this.legalEntityNotificationRecipients,
      { legalEntityId: s.legalEntityId, fallbackUserId: s.legalEntityId, audience: "seller" },
    );
    for (const recipientId of recipients) {
      await this.dispatcher.dispatch(recipientId, {
        type: "submission_rejected",
        title: "Submission not accepted",
        message: `Your submission "${s.title}" was not accepted: ${rejectionReason}`,
      });
    }
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
  if (patch.yearOfWork !== undefined) out.yearOfWork = patch.yearOfWork ?? null;
  if (patch.isSigned !== undefined) out.isSigned = patch.isSigned;
  if (patch.signatureNote !== undefined) out.signatureNote = patch.signatureNote ?? null;
  if (patch.edition !== undefined) out.edition = patch.edition ?? null;
  if (patch.conditionSelfReport !== undefined)
    out.conditionSelfReport = patch.conditionSelfReport ?? null;
  if (patch.provenance !== undefined) out.provenance = patch.provenance;
  if (patch.exhibitions !== undefined) out.exhibitions = patch.exhibitions;
  if (patch.askingPrice !== undefined) out.askingPrice = patch.askingPrice ?? null;
  if (patch.reservePrice !== undefined) out.reservePrice = patch.reservePrice ?? null;
  if (patch.categoryIds !== undefined) out.categoryIds = patch.categoryIds;
  else if (patch.categoryId !== undefined) out.categoryId = patch.categoryId;
  if (patch.submitterNotes !== undefined) out.submitterNotes = patch.submitterNotes ?? null;
  return out;
}
