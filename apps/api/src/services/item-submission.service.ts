import type { Database } from "@auction/db";
import {
  canTransition,
  evaluateLotReadiness,
  evaluateSubmissionQuality,
  transitionErrorMessage,
} from "@auction/domain";
import type {
  CreateItemSubmissionInput,
  ItemSubmission,
  ItemSubmissionStatus,
  LegalEntityStatus,
  Lot,
  UpdateItemSubmissionInput,
} from "@auction/types";
import {
  type UserRole,
  canAccessAdminSubmissionNotesWrite,
  canAccessAdminSubmissionsRead,
  normalizeUserStaffRole,
} from "@auction/types";
import { adminSubmissionNotesSchema, updateItemSubmissionSchema } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../lib/errors.js";
import { presentSubmissionImages, presentSubmissionsImages } from "../lib/media-presenters.js";
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
import type { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
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
    private readonly mediaUrlResolver: MediaUrlResolver | undefined = undefined,
    private readonly mediaAssetEnricher: MediaAssetEnricher | undefined = undefined,
    private readonly lotLifecycleRecording: LotLifecycleRecording | null = null,
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
    const { actorId, role, staffRole, submissionId, sellerPatch, adminNotes } = input;
    const s = await this.submissions.findById(submissionId);
    if (!s) return err(new SubmissionError("Not found", 404));

    const staff = normalizeUserStaffRole(staffRole);
    if (canAccessAdminSubmissionNotesWrite(role as UserRole, staff)) {
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
    if (!canTransition(s.status, "submit")) {
      return err(new SubmissionError(transitionErrorMessage(s.status, "submit")));
    }
    const quality = evaluateSubmissionQuality(s);
    if (!quality.canSubmit) {
      return err(
        new SubmissionError(
          "Complete required fields before submitting: title, category, and at least one image",
          400,
        ),
      );
    }
    const updated = await this.submissions.update(id, { status: "submitted" });
    await this.maybeLogRestrictedSellerWrite(legalEntityId, id, "submit_for_review");
    const admins = await this.users.listStaffIdsForSubmissionNotifications();
    for (const aid of admins) {
      await this.dispatcher.dispatch(aid, {
        type: "submission_received_for_review",
        title: "New item submission",
        message: `A seller submitted "${updated.title}" for review.`,
        submissionId: id,
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

  async assignForAdmin(
    _adminId: string,
    id: string,
    assignedToUserId: string | null,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s) return err(new SubmissionError("Not found", 404));
    if (s.status !== "submitted" && s.status !== "under_review") {
      return err(new SubmissionError("Assignment is only allowed while awaiting decision", 400));
    }
    if (assignedToUserId) {
      const assignee = await this.users.findById(assignedToUserId);
      if (!assignee) return err(new SubmissionError("Assignee not found", 404));
      const role = assignee.role as UserRole;
      if (!canAccessAdminSubmissionsRead(role, normalizeUserStaffRole(assignee.staffRole))) {
        return err(new SubmissionError("Assignee must be staff with submissions access", 400));
      }
    }
    const updated = await this.submissions.update(id, {
      assignedToUserId: assignedToUserId ?? null,
    });
    return ok(updated);
  }

  async startReview(
    _adminId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s) return err(new SubmissionError("Not found", 404));
    if (!canTransition(s.status, "startReview")) {
      return err(new SubmissionError(transitionErrorMessage(s.status, "startReview")));
    }
    const updated = await this.submissions.update(id, {
      status: "under_review",
      assignedToUserId: _adminId,
    });
    return ok(updated);
  }

  async accept(
    adminId: string,
    id: string,
    input: Pick<ApproveSubmissionInput, "reviewNotes"> | undefined = undefined,
    options: { notifySeller?: boolean } = {},
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s) return err(new SubmissionError("Not found", 404));
    if (!canTransition(s.status, "accept")) {
      return err(new SubmissionError(transitionErrorMessage(s.status, "accept")));
    }
    if (!s.legalEntityId) {
      return err(new SubmissionError("Legal entity context missing", 400));
    }
    const quality = evaluateSubmissionQuality(s);
    if (!quality.canAccept) {
      return err(
        new SubmissionError("Submission does not meet minimum requirements for acceptance", 400),
      );
    }
    const updated = await this.submissions.update(id, {
      status: "approved",
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNotes: input?.reviewNotes?.trim() ? input.reviewNotes.trim() : null,
      rejectionReason: null,
    });
    if (options.notifySeller !== false) {
      const recipients = await resolveLegalEntityNotificationRecipients(
        this.legalEntityNotificationRecipients,
        { legalEntityId: s.legalEntityId, fallbackUserId: s.legalEntityId, audience: "seller" },
      );
      for (const recipientId of recipients) {
        await this.dispatcher.dispatch(recipientId, {
          type: "submission_approved",
          title: "Submission accepted",
          message: `Your submission "${s.title}" was accepted for cataloguing. Our specialists are preparing your catalogue entry.`,
          submissionId: id,
        });
      }
    }
    return ok(updated);
  }

  async convert(
    adminId: string,
    id: string,
    input: ApproveSubmissionInput | undefined = undefined,
  ): Promise<
    Result<{ submission: ItemSubmission; lot: Lot; readinessPercent: number }, SubmissionError>
  > {
    const reviewNotes = input?.reviewNotes;
    const requestedArtistId = input?.artistId ?? null;
    const newArtist = input?.newArtist;
    if (requestedArtistId && newArtist) {
      return err(new SubmissionError("Provide either artistId or newArtist, not both", 400));
    }
    try {
      const { lot, submission, legalEntityId, title, readinessPercent } = await this.db.transaction(
        async (tx) => {
          const subRepo = new DrizzleItemSubmissionRepository(tx);
          const lotRepo = new DrizzleLotRepository(tx);
          const s = await subRepo.findById(id);
          if (!s) {
            throw new SubmissionError("Not found", 404);
          }
          if (!canTransition(s.status, "convert")) {
            throw new SubmissionError(transitionErrorMessage(s.status, "convert"));
          }
          if (!s.legalEntityId) {
            throw new SubmissionError("Legal entity context missing", 400);
          }
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
          if (this.lotLifecycleRecording) {
            await this.lotLifecycleRecording.recordCreated(tx, {
              lot: createdLot,
              source: "submission",
              actorUserId: adminId,
            });
          }
          const submission = await subRepo.update(id, {
            status: "converted",
            convertedLotId: createdLot.id,
            reviewedBy: adminId,
            reviewedAt: new Date(),
            ...(reviewNotes?.trim() ? { reviewNotes: reviewNotes.trim() } : {}),
            rejectionReason: null,
          });
          const readiness = evaluateLotReadiness(createdLot);
          return {
            lot: createdLot,
            submission,
            legalEntityId: s.legalEntityId,
            title: s.title,
            readinessPercent: readiness.percent,
          };
        },
      );
      const recipients = await resolveLegalEntityNotificationRecipients(
        this.legalEntityNotificationRecipients,
        { legalEntityId, fallbackUserId: legalEntityId, audience: "seller" },
      );
      for (const recipientId of recipients) {
        await this.dispatcher.dispatch(recipientId, {
          type: "submission_converted",
          title: "Draft lot created",
          message: `A draft catalogue lot was created for "${title}". Complete any remaining steps in your seller dashboard.`,
          lotId: lot.id,
          submissionId: id,
          meta: { lotTitle: title },
        });
      }
      return ok({ submission, lot, readinessPercent });
    } catch (e) {
      if (e instanceof SubmissionError) {
        return err(e);
      }
      throw e;
    }
  }

  /** Backward-compatible: accept then convert in one call. */
  async approve(
    adminId: string,
    id: string,
    input: ApproveSubmissionInput | undefined = undefined,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>> {
    if (input?.artistId && input?.newArtist) {
      return err(new SubmissionError("Provide either artistId or newArtist, not both", 400));
    }
    const s = await this.submissions.findById(id);
    if (!s) return err(new SubmissionError("Not found", 404));
    if (s.status === "under_review") {
      const accepted = await this.accept(
        adminId,
        id,
        { reviewNotes: input?.reviewNotes },
        { notifySeller: false },
      );
      if (accepted.isErr()) return err(accepted.error);
    } else if (s.status !== "approved") {
      return err(new SubmissionError(transitionErrorMessage(s.status, "accept")));
    }
    const converted = await this.convert(adminId, id, input);
    if (converted.isErr()) return err(converted.error);
    return ok({ submission: converted.value.submission, lot: converted.value.lot });
  }

  async reject(
    adminId: string,
    id: string,
    rejectionReason: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const s = await this.submissions.findById(id);
    if (!s) return err(new SubmissionError("Not found", 404));
    if (!canTransition(s.status, "reject")) {
      return err(new SubmissionError(transitionErrorMessage(s.status, "reject")));
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
        submissionId: id,
      });
    }
    return ok(updated);
  }

  async listSubmissionsForSellerApi(
    legalEntityId: string,
    f: ListSubmissionsFilter,
  ): Promise<{ data: ItemSubmission[]; total: number }> {
    const countFilter: Omit<ListSubmissionsFilter, "limit" | "offset"> = {
      ...(f.status ? { status: f.status } : {}),
      ...(f.statuses && f.statuses.length > 0 ? { statuses: f.statuses } : {}),
      ...(f.q ? { q: f.q } : {}),
    };
    const [rows, total] = await Promise.all([
      this.listForSeller(legalEntityId, f),
      this.submissions.countForLegalEntity(legalEntityId, countFilter),
    ]);
    const data = await presentSubmissionsImages(
      this.mediaUrlResolver,
      rows,
      this.mediaAssetEnricher,
    );
    return { data, total };
  }

  async getSubmissionSummaryForSellerApi(
    legalEntityId: string,
  ): Promise<{ counts: Record<ItemSubmissionStatus, number>; total: number }> {
    const counts = await this.submissions.countStatusForLegalEntity(legalEntityId);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return { counts, total };
  }

  async listSubmissionsForAdminApi(
    f: ListSubmissionsFilter,
  ): Promise<{ data: ItemSubmission[]; total: number }> {
    const countFilter: Omit<ListSubmissionsFilter, "limit" | "offset"> = {
      legalEntityId: f.legalEntityId,
      q: f.q,
      ...(f.statuses && f.statuses.length > 0 ? { statuses: f.statuses } : {}),
      ...(f.status && !(f.statuses && f.statuses.length > 0) ? { status: f.status } : {}),
      ...(f.qualityGaps ? { qualityGaps: true } : {}),
      ...(f.assignedToUserId ? { assignedToUserId: f.assignedToUserId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.listForAdmin(f),
      this.submissions.countAdmin(countFilter),
    ]);
    const data = await presentSubmissionsImages(
      this.mediaUrlResolver,
      rows,
      this.mediaAssetEnricher,
    );
    return { data, total };
  }

  async getSubmissionForViewerApi(input: {
    submissionId: string;
    role: UserRole;
    staffRole?: string | null;
    sellerLegalEntityId: string;
  }): Promise<Result<ItemSubmission, SubmissionError>> {
    const { submissionId, role, staffRole, sellerLegalEntityId } = input;
    const staff = normalizeUserStaffRole(staffRole);
    const result = canAccessAdminSubmissionsRead(role, staff)
      ? await this.getForAdmin(submissionId)
      : await this.getForSeller(sellerLegalEntityId, submissionId);
    if (result.isErr()) return result;
    return ok(
      await presentSubmissionImages(this.mediaUrlResolver, result.value, this.mediaAssetEnricher),
    );
  }

  async patchSubmissionFromRequestBody(input: {
    rawBody: unknown;
    submissionId: string;
    role: UserRole;
    staffRole?: string | null;
    userId: string;
    sellerLegalEntityId: string;
  }): Promise<
    | { kind: "ok"; data: ItemSubmission }
    | { kind: "bad_request"; details: unknown }
    | { kind: "err"; error: SubmissionError }
  > {
    const { rawBody, submissionId, role, staffRole, userId, sellerLegalEntityId } = input;
    const staff = normalizeUserStaffRole(staffRole);
    if (canAccessAdminSubmissionNotesWrite(role, staff)) {
      const parsed = adminSubmissionNotesSchema.safeParse(rawBody);
      if (!parsed.success) {
        return { kind: "bad_request", details: parsed.error.flatten() };
      }
      const result = await this.updateForActor({
        actorId: userId,
        role,
        staffRole: staffRole ?? null,
        submissionId,
        adminNotes: parsed.data,
      });
      if (result.isErr()) return { kind: "err", error: result.error };
      return {
        kind: "ok",
        data: await presentSubmissionImages(
          this.mediaUrlResolver,
          result.value,
          this.mediaAssetEnricher,
        ),
      };
    }
    const parsed = updateItemSubmissionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return { kind: "bad_request", details: parsed.error.flatten() };
    }
    const result = await this.updateForActor({
      actorId: sellerLegalEntityId,
      role,
      staffRole: staffRole ?? null,
      submissionId,
      sellerPatch: parsed.data as UpdateItemSubmissionInput,
    });
    if (result.isErr()) return { kind: "err", error: result.error };
    return {
      kind: "ok",
      data: await presentSubmissionImages(
        this.mediaUrlResolver,
        result.value,
        this.mediaAssetEnricher,
      ),
    };
  }

  async bulkApproveOrReject(input: {
    adminId: string;
    ids: string[];
    op: "approve" | "reject";
    reason?: string | undefined;
    reviewNotes?: string | undefined;
  }): Promise<
    | { kind: "ok"; count: number }
    | { kind: "bad_request"; message: string }
    | { kind: "err"; error: SubmissionError }
  > {
    const { adminId, ids, op, reason, reviewNotes } = input;
    if (op === "reject" && !reason?.trim()) {
      return { kind: "bad_request", message: "Reason is required to reject submissions" };
    }
    for (const id of ids) {
      if (op === "approve") {
        const s = await this.submissions.findById(id);
        if (!s) return { kind: "err", error: new SubmissionError("Not found", 404) };
        const quality = evaluateSubmissionQuality(s);
        if (!quality.canAccept) {
          return {
            kind: "bad_request",
            message: `Submission "${s.title}" is missing required fields and cannot be bulk accepted`,
          };
        }
      }
      const result =
        op === "approve"
          ? await this.accept(adminId, id, { reviewNotes })
          : await this.reject(adminId, id, reason?.trim() ?? "", reviewNotes);
      if (result.isErr()) {
        return { kind: "err", error: result.error };
      }
    }
    return { kind: "ok", count: ids.length };
  }

  async createDraftForSellerApi(
    legalEntityId: string,
    input: CreateItemSubmissionInput,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const result = await this.createDraft(legalEntityId, input);
    if (result.isErr()) return result;
    return ok(
      await presentSubmissionImages(this.mediaUrlResolver, result.value, this.mediaAssetEnricher),
    );
  }

  async submitForReviewForSellerApi(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const result = await this.submitForReview(legalEntityId, id);
    if (result.isErr()) return result;
    return ok(
      await presentSubmissionImages(this.mediaUrlResolver, result.value, this.mediaAssetEnricher),
    );
  }

  async withdrawForSellerApi(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const result = await this.withdraw(legalEntityId, id);
    if (result.isErr()) return result;
    return ok(
      await presentSubmissionImages(this.mediaUrlResolver, result.value, this.mediaAssetEnricher),
    );
  }

  async startReviewForAdminApi(
    adminId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const result = await this.startReview(adminId, id);
    if (result.isErr()) return result;
    return ok(
      await presentSubmissionImages(this.mediaUrlResolver, result.value, this.mediaAssetEnricher),
    );
  }

  async assignForAdminApi(
    adminId: string,
    id: string,
    assignedToUserId: string | null,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const result = await this.assignForAdmin(adminId, id, assignedToUserId);
    if (result.isErr()) return result;
    return ok(
      await presentSubmissionImages(this.mediaUrlResolver, result.value, this.mediaAssetEnricher),
    );
  }

  async countQualityGapsForAdminApi(): Promise<number> {
    return this.submissions.countAdmin({
      statuses: ["submitted", "under_review"],
      qualityGaps: true,
    });
  }

  async countSubmissionsBySellersForAdminApi(sellerIds: readonly string[]): Promise<number> {
    return this.submissions.countAdminForLegalEntityIds(sellerIds);
  }

  async sendStaleDraftReminders(input: {
    staleDays: number;
    batchLimit?: number;
    maxBatches?: number;
  }): Promise<{ reminded: number }> {
    const batchLimit = input.batchLimit ?? 50;
    const maxBatches = input.maxBatches ?? 10;
    const cutoff = new Date(Date.now() - input.staleDays * 24 * 60 * 60 * 1000);
    let reminded = 0;
    for (let batch = 0; batch < maxBatches; batch += 1) {
      const rows = await this.submissions.listStaleDraftsWithoutReminder(cutoff, batchLimit);
      if (rows.length === 0) break;
      for (const s of rows) {
        if (!s.legalEntityId) continue;
        const recipients = await resolveLegalEntityNotificationRecipients(
          this.legalEntityNotificationRecipients,
          { legalEntityId: s.legalEntityId, fallbackUserId: s.legalEntityId, audience: "seller" },
        );
        for (const recipientId of recipients) {
          await this.dispatcher.dispatch(recipientId, {
            type: "submission_draft_reminder",
            title: "Submission waiting",
            message: `Your in-progress submission "${s.title}" has not been updated in ${input.staleDays} days. Resume when you are ready to submit for review.`,
            submissionId: s.id,
          });
        }
        await this.submissions.update(s.id, { draftReminderSentAt: new Date() });
        reminded += 1;
      }
      if (rows.length < batchLimit) break;
    }
    return { reminded };
  }

  async acceptForAdminApi(
    adminId: string,
    id: string,
    body: Pick<ApproveSubmissionInput, "reviewNotes">,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const result = await this.accept(adminId, id, body);
    if (result.isErr()) return result;
    return ok(
      await presentSubmissionImages(this.mediaUrlResolver, result.value, this.mediaAssetEnricher),
    );
  }

  async convertForAdminApi(
    adminId: string,
    id: string,
    body: ApproveSubmissionInput,
  ): Promise<
    Result<{ submission: ItemSubmission; lot: Lot; readinessPercent: number }, SubmissionError>
  > {
    const result = await this.convert(adminId, id, body);
    if (result.isErr()) return result;
    const submission = await presentSubmissionImages(
      this.mediaUrlResolver,
      result.value.submission,
      this.mediaAssetEnricher,
    );
    return ok({
      submission,
      lot: result.value.lot,
      readinessPercent: result.value.readinessPercent,
    });
  }

  async approveForAdminApi(
    adminId: string,
    id: string,
    body: ApproveSubmissionInput,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>> {
    const result = await this.approve(adminId, id, body);
    if (result.isErr()) return result;
    const submission = await presentSubmissionImages(
      this.mediaUrlResolver,
      result.value.submission,
      this.mediaAssetEnricher,
    );
    return ok({ submission, lot: result.value.lot });
  }

  async rejectForAdminApi(
    adminId: string,
    id: string,
    rejectionReason: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    const result = await this.reject(adminId, id, rejectionReason, reviewNotes);
    if (result.isErr()) return result;
    return ok(
      await presentSubmissionImages(this.mediaUrlResolver, result.value, this.mediaAssetEnricher),
    );
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
