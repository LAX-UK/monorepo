import type { ITransactionRunner } from "@auction/persistence";
import type { LegalEntityStatus, UpdateItemSubmissionInput } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ImageCleanupService } from "../image-cleanup.service.js";
import type { ILegalEntityNotificationRecipientReader } from "../interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type {
  IItemSubmissionRepository,
  IUserRepository,
  ItemSubmissionUpdatePatch,
} from "../interfaces/repositories.js";
import type { IRepositoryFactory } from "../interfaces/repository-factory.js";
import type { MediaAssetEnricher } from "../media-asset-enricher.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

export const SELLER_ENTITY_WRITE_STATUSES = new Set<LegalEntityStatus>(["approved", "restricted"]);

export const INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES = new Set<LegalEntityStatus>([
  "rejected",
  "archived",
]);

/** Resolved deps record built once in ItemSubmissionService constructor. */
export type ItemSubmissionServiceDeps = {
  transactionRunner: ITransactionRunner;
  submissions: IItemSubmissionRepository;
  users: IUserRepository;
  dispatcher: NotificationDispatcher;
  imageCleanup: ImageCleanupService | undefined;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventPublisher: DomainEventPublisher | null;
  domainEventSink: IDomainEventSink | null;
  mediaUrlResolver: MediaUrlResolver | undefined;
  mediaAssetEnricher: MediaAssetEnricher | undefined;
  lotLifecycleRecording: ILotLifecycleRecorder | null;
  repoFactory: IRepositoryFactory | null;
};

export function sellerPatchToRepoPatch(
  patch: UpdateItemSubmissionInput,
): ItemSubmissionUpdatePatch {
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
