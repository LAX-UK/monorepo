import type { ServiceResult } from "../http/service-result";

export type AdminComplianceBulkDownload = {
  data: ArrayBuffer;
  fileName: string;
};

export type AdminComplianceDocumentDownload = {
  url: string;
};

export interface IAdminComplianceService {
  amlTriage(
    screeningId: string,
    recommendation: "clear" | "block",
    notes?: string,
  ): Promise<ServiceResult<unknown>>;
  amlDecide(
    screeningId: string,
    decision: "clear" | "block",
    notes?: string,
  ): Promise<ServiceResult<unknown>>;
  sofTriage(
    caseId: string,
    recommendation: "approve" | "reject",
    notes?: string,
  ): Promise<ServiceResult<unknown>>;
  sofDecide(
    caseId: string,
    decision: "approve" | "reject",
    notes?: string,
  ): Promise<ServiceResult<unknown>>;
  sofReopen(caseId: string): Promise<ServiceResult<unknown>>;
  downloadSofDocument(
    caseId: string,
    documentId: string,
  ): Promise<ServiceResult<AdminComplianceDocumentDownload>>;
  downloadAllSofDocuments(caseId: string): Promise<ServiceResult<AdminComplianceBulkDownload>>;
  requestSofDocuments(
    caseId: string,
    documentTypes: string[],
    note?: string,
  ): Promise<ServiceResult<unknown>>;
  reviewSofDocument(
    caseId: string,
    documentId: string,
    checks: {
      matchesDeclaredSource?: boolean;
      coversExposure?: boolean;
      recentEnough?: boolean;
      legibleComplete?: boolean;
    },
    note?: string,
  ): Promise<ServiceResult<unknown>>;
}
