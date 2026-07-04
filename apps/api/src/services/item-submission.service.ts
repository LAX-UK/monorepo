import type { ITransactionRunner } from "@auction/persistence";
import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type {
  IItemSubmissionRepository,
  IUserRepository,
  ListSubmissionsFilter,
} from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type {
  CreateItemSubmissionInput,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
} from "@auction/types";
import type { UserRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { SubmissionError } from "../lib/errors.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type {
  ApproveSubmissionInput,
  IItemSubmissionService,
  UpdateSubmissionActorInput,
} from "./interfaces/item-submission-service.js";
import type { ILotLifecycleRecorder } from "./interfaces/lot-lifecycle-recorder.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import {
  accept,
  approve,
  bulkApproveOrReject,
  reject,
} from "./submission/submission-admin-decisions.js";
import { assignForAdmin, startReview } from "./submission/submission-admin-review.js";
import {
  acceptForAdminApi,
  approveForAdminApi,
  assignForAdminApi,
  convertForAdminApi,
  countQualityGapsForAdminApi,
  countSubmissionsBySellersForAdminApi,
  createDraftForSellerApi,
  getSubmissionForViewerApi,
  getSubmissionSummaryForSellerApi,
  listSubmissionsForAdminApi,
  listSubmissionsForSellerApi,
  patchSubmissionFromRequestBody,
  rejectForAdminApi,
  sendStaleDraftReminders,
  startReviewForAdminApi,
  submitForReviewForSellerApi,
  withdrawForSellerApi,
} from "./submission/submission-api.js";
import { convert } from "./submission/submission-convert-to-lot.js";
import {
  countPendingForAdmin,
  getForAdmin,
  getForSeller,
  listForAdmin,
  listForSeller,
} from "./submission/submission-read.js";
import {
  createDraft,
  submitForReview,
  updateForActor,
  withdraw,
} from "./submission/submission-seller-lifecycle.js";
import type { ItemSubmissionServiceDeps } from "./submission/submission-types.js";

export class ItemSubmissionService implements IItemSubmissionService {
  private readonly deps: ItemSubmissionServiceDeps;

  constructor(
    transactionRunner: ITransactionRunner,
    submissions: IItemSubmissionRepository,
    users: IUserRepository,
    dispatcher: NotificationDispatcher,
    imageCleanup?: ImageCleanupService,
    legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null = null,
    legalEntityRepository: ILegalEntityRepository | null = null,
    domainEventSink: IDomainEventSink | null = null,
    mediaUrlResolver: MediaUrlResolver | undefined = undefined,
    mediaAssetEnricher: MediaAssetEnricher | undefined = undefined,
    lotLifecycleRecording: ILotLifecycleRecorder | null = null,
    repoFactory: IRepositoryFactory | null = null,
  ) {
    this.deps = {
      transactionRunner,
      submissions,
      users,
      dispatcher,
      imageCleanup,
      legalEntityNotificationRecipients,
      legalEntityRepository,
      domainEventSink,
      mediaUrlResolver,
      mediaAssetEnricher,
      lotLifecycleRecording,
      repoFactory,
    };
  }

  createDraft(
    legalEntityId: string,
    input: CreateItemSubmissionInput,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return createDraft(this.deps, legalEntityId, input);
  }

  updateForActor(
    input: UpdateSubmissionActorInput,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return updateForActor(this.deps, input);
  }

  submitForReview(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return submitForReview(this.deps, legalEntityId, id);
  }

  withdraw(legalEntityId: string, id: string): Promise<Result<ItemSubmission, SubmissionError>> {
    return withdraw(this.deps, legalEntityId, id);
  }

  listForSeller(legalEntityId: string, f: ListSubmissionsFilter): Promise<ItemSubmission[]> {
    return listForSeller(this.deps, legalEntityId, f);
  }

  getForSeller(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return getForSeller(this.deps, legalEntityId, id);
  }

  listForAdmin(f: ListSubmissionsFilter): Promise<ItemSubmission[]> {
    return listForAdmin(this.deps, f);
  }

  getForAdmin(id: string): Promise<Result<ItemSubmission, SubmissionError>> {
    return getForAdmin(this.deps, id);
  }

  countPendingForAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number> {
    return countPendingForAdmin(this.deps, f);
  }

  assignForAdmin(
    adminId: string,
    id: string,
    assignedToUserId: string | null,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return assignForAdmin(this.deps, adminId, id, assignedToUserId);
  }

  startReview(adminId: string, id: string): Promise<Result<ItemSubmission, SubmissionError>> {
    return startReview(this.deps, adminId, id);
  }

  accept(
    adminId: string,
    id: string,
    input?: Pick<ApproveSubmissionInput, "reviewNotes"> | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return accept(this.deps, adminId, id, input);
  }

  convert(
    adminId: string,
    id: string,
    input?: ApproveSubmissionInput | undefined,
  ): Promise<
    Result<{ submission: ItemSubmission; lot: Lot; readinessPercent: number }, SubmissionError>
  > {
    return convert(this.deps, adminId, id, input);
  }

  approve(
    adminId: string,
    id: string,
    input?: ApproveSubmissionInput | undefined,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>> {
    return approve(this.deps, adminId, id, input);
  }

  reject(
    adminId: string,
    id: string,
    rejectionReason: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return reject(this.deps, adminId, id, rejectionReason, reviewNotes);
  }

  listSubmissionsForSellerApi(
    legalEntityId: string,
    f: ListSubmissionsFilter,
  ): Promise<{ data: ItemSubmission[]; total: number }> {
    return listSubmissionsForSellerApi(this.deps, legalEntityId, f);
  }

  getSubmissionSummaryForSellerApi(
    legalEntityId: string,
  ): Promise<{ counts: Record<ItemSubmissionStatus, number>; total: number }> {
    return getSubmissionSummaryForSellerApi(this.deps, legalEntityId);
  }

  listSubmissionsForAdminApi(
    f: ListSubmissionsFilter,
  ): Promise<{ data: ItemSubmission[]; total: number }> {
    return listSubmissionsForAdminApi(this.deps, f);
  }

  getSubmissionForViewerApi(input: {
    submissionId: string;
    role: UserRole;
    staffRole?: string | null;
    sellerLegalEntityId: string;
  }): Promise<Result<ItemSubmission, SubmissionError>> {
    return getSubmissionForViewerApi(this.deps, input);
  }

  patchSubmissionFromRequestBody(input: {
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
    return patchSubmissionFromRequestBody(this.deps, input);
  }

  bulkApproveOrReject(input: {
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
    return bulkApproveOrReject(this.deps, input);
  }

  createDraftForSellerApi(
    legalEntityId: string,
    input: CreateItemSubmissionInput,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return createDraftForSellerApi(this.deps, legalEntityId, input);
  }

  submitForReviewForSellerApi(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return submitForReviewForSellerApi(this.deps, legalEntityId, id);
  }

  withdrawForSellerApi(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return withdrawForSellerApi(this.deps, legalEntityId, id);
  }

  startReviewForAdminApi(
    adminId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return startReviewForAdminApi(this.deps, adminId, id);
  }

  assignForAdminApi(
    adminId: string,
    id: string,
    assignedToUserId: string | null,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return assignForAdminApi(this.deps, adminId, id, assignedToUserId);
  }

  countQualityGapsForAdminApi(): Promise<number> {
    return countQualityGapsForAdminApi(this.deps);
  }

  countSubmissionsBySellersForAdminApi(sellerIds: readonly string[]): Promise<number> {
    return countSubmissionsBySellersForAdminApi(this.deps, sellerIds);
  }

  sendStaleDraftReminders(input: {
    staleDays: number;
    batchLimit?: number;
    maxBatches?: number;
  }): Promise<{ reminded: number }> {
    return sendStaleDraftReminders(this.deps, input);
  }

  acceptForAdminApi(
    adminId: string,
    id: string,
    body: Pick<ApproveSubmissionInput, "reviewNotes">,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return acceptForAdminApi(this.deps, adminId, id, body);
  }

  convertForAdminApi(
    adminId: string,
    id: string,
    body: ApproveSubmissionInput,
  ): Promise<
    Result<{ submission: ItemSubmission; lot: Lot; readinessPercent: number }, SubmissionError>
  > {
    return convertForAdminApi(this.deps, adminId, id, body);
  }

  approveForAdminApi(
    adminId: string,
    id: string,
    body: ApproveSubmissionInput,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>> {
    return approveForAdminApi(this.deps, adminId, id, body);
  }

  rejectForAdminApi(
    adminId: string,
    id: string,
    rejectionReason: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>> {
    return rejectForAdminApi(this.deps, adminId, id, rejectionReason, reviewNotes);
  }
}
