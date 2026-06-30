import type {
  AdminDisputeCaseRow,
  AdminDisputeCaseSummary,
  DisputeCaseListFilter,
  LegalEntity,
  LegalEntityStatus,
} from "@auction/types";
import type { Result } from "neverthrow";
import type { LifecycleAdminOp } from "../../../lib/legal-entity-lifecycle-transitions.js";
import type { AdminSourceOfFundsQueryService } from "../../admin/admin-source-of-funds-query.service.js";
import type {
  AdminLegalEntityDocumentDto,
  LegalEntityDocumentAdminService,
} from "../../admin/legal-entity-document-admin.service.js";
import type { AmlService } from "../../aml/aml.service.js";
import type { LegalEntityLifecycleFailure } from "../../legal-entity-lifecycle-admin.service.js";
import type { SourceOfFundsDocumentCollectionService } from "../../source-of-funds/source-of-funds-document-collection.service.js";
import type { SourceOfFundsDocumentReviewService } from "../../source-of-funds/source-of-funds-document-review.service.js";
import type { SourceOfFundsService } from "../../source-of-funds/source-of-funds.service.js";

export type { AdminDisputeCaseRow, AdminDisputeCaseSummary, DisputeCaseListFilter };

export interface IAdminDisputeCaseQueryService {
  listCases(input: {
    limit: number;
    offset: number;
    status?: DisputeCaseListFilter;
  }): Promise<{
    rows: AdminDisputeCaseRow[];
    hasNextPage: boolean;
    summary: AdminDisputeCaseSummary;
  }>;
  countOpenCases(): Promise<number>;
}

export interface IAdminLegalEntityLifecycleApplicationService {
  findLegalEntityById(id: string): Promise<LegalEntity | null>;
  runTransition(
    userId: string,
    entityId: string,
    op: LifecycleAdminOp,
    reason?: string | null,
  ): Promise<Result<{ id: string; status: LegalEntityStatus }, LegalEntityLifecycleFailure>>;
  listDocuments(entityId: string): Promise<AdminLegalEntityDocumentDto[] | null>;
  reviewDocument: LegalEntityDocumentAdminService["reviewDocument"];
}

export interface IAdminAmlApplicationService {
  listForUser: AmlService["listForUser"];
  listPendingReviews: AmlService["listPendingReviews"];
  countPendingReviews: AmlService["countPendingReviews"];
  triage: AmlService["triage"];
  decide: AmlService["decide"];
}

export interface IAdminSourceOfFundsApplicationService {
  readonly staffPreviewEnv: {
    WEB_ORIGIN: string;
    WEB_ORIGINS?: string[] | undefined;
    SSR_TRUSTED_ORIGINS?: string[] | undefined;
  };
  listEnriched: AdminSourceOfFundsQueryService["listEnriched"];
  getDetail: AdminSourceOfFundsQueryService["getDetail"];
  listForUser: AdminSourceOfFundsQueryService["listForUser"];
  triage: SourceOfFundsService["triage"];
  decide: SourceOfFundsService["decide"];
  reopenRejected: SourceOfFundsService["reopenRejected"];
  requestDocuments: SourceOfFundsDocumentCollectionService["requestDocuments"];
  getStaffDownloadUrl: SourceOfFundsDocumentCollectionService["getStaffDownloadUrl"];
  getStaffBulkDownloadZip: SourceOfFundsDocumentCollectionService["getStaffBulkDownloadZip"];
  getStaffPreviewBytes: SourceOfFundsDocumentCollectionService["getStaffPreviewBytes"];
  reviewDocument: SourceOfFundsDocumentReviewService["reviewDocument"];
}

export type AdminComplianceRouteServices = {
  disputeCases: IAdminDisputeCaseQueryService;
  legalEntityLifecycle: IAdminLegalEntityLifecycleApplicationService;
  aml: IAdminAmlApplicationService;
  sourceOfFunds: IAdminSourceOfFundsApplicationService;
};
