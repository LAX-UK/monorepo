import type { IAdminSourceOfFundsApplicationService } from "../interfaces/admin-routes.js";
import type { SourceOfFundsDocumentCollectionService } from "../source-of-funds/source-of-funds-document-collection.service.js";
import type { SourceOfFundsDocumentReviewService } from "../source-of-funds/source-of-funds-document-review.service.js";
import type { SourceOfFundsService } from "../source-of-funds/source-of-funds.service.js";
import type { AdminSourceOfFundsQueryService } from "./admin-source-of-funds-query.service.js";

export class AdminSourceOfFundsApplicationService implements IAdminSourceOfFundsApplicationService {
  readonly staffPreviewEnv: IAdminSourceOfFundsApplicationService["staffPreviewEnv"];

  constructor(
    private readonly query: AdminSourceOfFundsQueryService,
    private readonly lifecycle: SourceOfFundsService,
    private readonly documentCollection: SourceOfFundsDocumentCollectionService,
    private readonly documentReview: SourceOfFundsDocumentReviewService,
    staffPreviewEnv: IAdminSourceOfFundsApplicationService["staffPreviewEnv"],
  ) {
    this.staffPreviewEnv = staffPreviewEnv;
  }

  listEnriched(...args: Parameters<AdminSourceOfFundsQueryService["listEnriched"]>) {
    return this.query.listEnriched(...args);
  }

  getDetail(...args: Parameters<AdminSourceOfFundsQueryService["getDetail"]>) {
    return this.query.getDetail(...args);
  }

  listForUser(...args: Parameters<AdminSourceOfFundsQueryService["listForUser"]>) {
    return this.query.listForUser(...args);
  }

  triage(...args: Parameters<SourceOfFundsService["triage"]>) {
    return this.lifecycle.triage(...args);
  }

  decide(...args: Parameters<SourceOfFundsService["decide"]>) {
    return this.lifecycle.decide(...args);
  }

  reopenRejected(...args: Parameters<SourceOfFundsService["reopenRejected"]>) {
    return this.lifecycle.reopenRejected(...args);
  }

  requestDocuments(
    ...args: Parameters<SourceOfFundsDocumentCollectionService["requestDocuments"]>
  ) {
    return this.documentCollection.requestDocuments(...args);
  }

  getStaffDownloadUrl(
    ...args: Parameters<SourceOfFundsDocumentCollectionService["getStaffDownloadUrl"]>
  ) {
    return this.documentCollection.getStaffDownloadUrl(...args);
  }

  getStaffBulkDownloadZip(
    ...args: Parameters<SourceOfFundsDocumentCollectionService["getStaffBulkDownloadZip"]>
  ) {
    return this.documentCollection.getStaffBulkDownloadZip(...args);
  }

  getStaffPreviewBytes(
    ...args: Parameters<SourceOfFundsDocumentCollectionService["getStaffPreviewBytes"]>
  ) {
    return this.documentCollection.getStaffPreviewBytes(...args);
  }

  reviewDocument(...args: Parameters<SourceOfFundsDocumentReviewService["reviewDocument"]>) {
    return this.documentReview.reviewDocument(...args);
  }
}
