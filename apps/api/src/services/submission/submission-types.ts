import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type {
  IItemSubmissionRepository,
  IStaffRoleAssignmentReader,
  IUserRepository,
  ItemSubmissionUpdatePatch,
} from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { IConsignmentAgreementRepository } from "@auction/persistence/interfaces";
import type { UpdateItemSubmissionInput } from "@auction/types";
import type { IConsignmentAssignment } from "../consignment-messages/consignment-message.ports.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ImageCleanupService } from "../image-cleanup.service.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { MediaAssetEnricher } from "../media-asset-enricher.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { ISellerIdentityReader } from "./seller-identity.reader.js";

export {
  INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES,
  SELLER_ENTITY_WRITE_STATUSES,
} from "@auction/domain";

/** Resolved deps record built once in ItemSubmissionService constructor. */
export type ItemSubmissionServiceDeps = {
  transactionRunner: ITransactionRunner;
  submissions: IItemSubmissionRepository;
  users: IUserRepository;
  dispatcher: NotificationDispatcher;
  imageCleanup: ImageCleanupService | undefined;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventSink: IDomainEventSink | null;
  mediaUrlResolver: MediaUrlResolver | undefined;
  mediaAssetEnricher: MediaAssetEnricher | undefined;
  lotLifecycleRecording: ILotLifecycleRecorder | null;
  repoFactory: IRepositoryFactory | null;
  /** Consignment agreements: proposed on acceptance, required before cataloguing. */
  consignmentAgreements: IConsignmentAgreementRepository | null;
  /** The seller's checked identity; a specialist accepts the work only once it is verified. */
  sellerIdentity: ISellerIdentityReader | null;
  /** Roles in force of the staff member a submission is assigned to. */
  staffRoles: Pick<IStaffRoleAssignmentReader, "listActiveRoles"> | null;
  /**
   * Hands the consignment's thread over with its owner and records it in the thread's history.
   * Without it (tests, tools) the owner changes on the record alone.
   */
  consignmentAssignment?: IConsignmentAssignment | null;
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
