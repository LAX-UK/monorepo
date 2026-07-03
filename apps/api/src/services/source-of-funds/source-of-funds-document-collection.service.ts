import type { Database } from "@auction/db";
import type { ISourceOfFundsDocumentReviewRepository } from "@auction/persistence";
import type { ISourceOfFundsDocumentRepository } from "../../repositories/drizzle-source-of-funds-document.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IObjectStorage } from "../interfaces/object-storage.js";
import type { ISourceOfFundsDocumentCollectionService } from "../interfaces/source-of-funds-document-collection.js";
import type { ISignedUrlPolicy } from "../signed-url-policy.js";
import { SourceOfFundsDocumentCollectionBuyerService } from "./source-of-funds-document-collection-buyer.service.js";
import { createSourceOfFundsDocumentCollectionContext } from "./source-of-funds-document-collection-context.js";
import { SourceOfFundsDocumentCollectionStaffService } from "./source-of-funds-document-collection-staff.service.js";
import type { SourceOfFundsSettlementReadService } from "./source-of-funds-settlement-read.service.js";
import type { ISourceOfFundsRepository } from "./source-of-funds.types.js";

export {
  clampStaffPreviewContentType,
  SOURCE_OF_FUNDS_DOCUMENTS_REQUESTED_EVENT,
  SOURCE_OF_FUNDS_DOCUMENTS_SUBMITTED_EVENT,
  SOURCE_OF_FUNDS_DOCUMENT_UPLOADED_EVENT,
  SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT,
} from "./source-of-funds-document-collection-context.js";
export type {
  AdminSourceOfFundsDocumentDto,
  BuyerSourceOfFundsDocumentDto,
  BuyerSourceOfFundsViewDto,
} from "../interfaces/source-of-funds-document-collection.js";

export class SourceOfFundsDocumentCollectionService
  implements ISourceOfFundsDocumentCollectionService
{
  private readonly buyer: SourceOfFundsDocumentCollectionBuyerService;
  private readonly staff: SourceOfFundsDocumentCollectionStaffService;

  constructor(
    caseRepo: ISourceOfFundsRepository,
    docRepo: ISourceOfFundsDocumentRepository,
    reviewRepo: ISourceOfFundsDocumentReviewRepository,
    db: Database,
    events: DomainEventPublisher | null,
    storage: IObjectStorage,
    downloadSigningPolicy: ISignedUrlPolicy,
    settlementRead: SourceOfFundsSettlementReadService,
  ) {
    const ctx = createSourceOfFundsDocumentCollectionContext({
      caseRepo,
      docRepo,
      reviewRepo,
      db,
      events,
      storage,
      downloadSigningPolicy,
      settlementRead,
    });
    this.buyer = new SourceOfFundsDocumentCollectionBuyerService(ctx);
    this.staff = new SourceOfFundsDocumentCollectionStaffService(ctx);
  }

  attachDocument(
    ...args: Parameters<SourceOfFundsDocumentCollectionBuyerService["attachDocument"]>
  ) {
    return this.buyer.attachDocument(...args);
  }

  submitDocuments(
    ...args: Parameters<SourceOfFundsDocumentCollectionBuyerService["submitDocuments"]>
  ) {
    return this.buyer.submitDocuments(...args);
  }

  getBuyerView(...args: Parameters<SourceOfFundsDocumentCollectionBuyerService["getBuyerView"]>) {
    return this.buyer.getBuyerView(...args);
  }

  requestDocuments(
    ...args: Parameters<SourceOfFundsDocumentCollectionStaffService["requestDocuments"]>
  ) {
    return this.staff.requestDocuments(...args);
  }

  getStaffDownloadUrl(
    ...args: Parameters<SourceOfFundsDocumentCollectionStaffService["getStaffDownloadUrl"]>
  ) {
    return this.staff.getStaffDownloadUrl(...args);
  }

  getStaffPreviewBytes(
    ...args: Parameters<SourceOfFundsDocumentCollectionStaffService["getStaffPreviewBytes"]>
  ) {
    return this.staff.getStaffPreviewBytes(...args);
  }

  getStaffBulkDownloadZip(
    ...args: Parameters<SourceOfFundsDocumentCollectionStaffService["getStaffBulkDownloadZip"]>
  ) {
    return this.staff.getStaffBulkDownloadZip(...args);
  }

  listDocumentsForCase(
    ...args: Parameters<SourceOfFundsDocumentCollectionStaffService["listDocumentsForCase"]>
  ) {
    return this.staff.listDocumentsForCase(...args);
  }
}
