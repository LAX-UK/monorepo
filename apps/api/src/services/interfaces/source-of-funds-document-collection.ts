import type {
  SourceOfFundsCase,
  SourceOfFundsDocumentRow,
} from "../source-of-funds/source-of-funds.types.js";

export type BuyerSourceOfFundsDocumentDto = {
  id: string;
  requestedType: string;
  label: string | null;
  fileName: string | null;
  statusLabel: "received" | "under_review" | "superseded";
  uploadedAt: string;
};

export type BuyerSourceOfFundsViewDto = {
  caseId: string;
  status: SourceOfFundsCase["status"];
  trigger: SourceOfFundsCase["trigger"];
  documentsRequested: boolean;
  documentsSubmitted: boolean;
  requestedDocumentTypes: string[];
  documentRequestNote: string | null;
  documents: BuyerSourceOfFundsDocumentDto[];
  settlementSummary: string | null;
  settlementItemCount: number;
  /** Shown only after terminal decision — no internal triage notes. */
  decisionOutcome: "approved" | "rejected" | null;
};

export type AdminSourceOfFundsDocumentDto = {
  id: string;
  requestedType: string;
  label: string | null;
  fileName: string | null;
  reviewStatus: string;
  uploadedAt: string;
  uploadedByUserId: string;
  downloadUrl: string | null;
};

export interface ISourceOfFundsDocumentCollectionBuyerService {
  attachDocument(command: {
    caseId: string;
    buyerUserId: string;
    uploadObjectId: string;
    requestedType: string;
    label: string | null;
  }): Promise<SourceOfFundsDocumentRow>;

  submitDocuments(command: {
    caseId: string;
    buyerUserId: string;
  }): Promise<SourceOfFundsCase>;

  getBuyerView(buyerUserId: string): Promise<BuyerSourceOfFundsViewDto | null>;
}

export interface ISourceOfFundsDocumentCollectionStaffService {
  requestDocuments(command: {
    caseId: string;
    staffUserId: string;
    documentTypes: string[];
    note: string | null;
  }): Promise<SourceOfFundsCase>;

  getStaffDownloadUrl(command: {
    caseId: string;
    documentId: string;
    staffUserId: string;
    clientIp?: string | null;
    preview?: boolean;
  }): Promise<{ url: string; fileName: string } | null>;

  getStaffPreviewBytes(command: {
    caseId: string;
    documentId: string;
    staffUserId: string;
    clientIp?: string | null;
    maxBytes?: number;
  }): Promise<{ buffer: Buffer; contentType: string; fileName: string } | null>;

  getStaffBulkDownloadZip(command: {
    caseId: string;
    staffUserId: string;
    clientIp?: string | null;
  }): Promise<{ buffer: Buffer; fileName: string } | null>;

  listDocumentsForCase(caseId: string): Promise<AdminSourceOfFundsDocumentDto[]>;
}

export interface ISourceOfFundsDocumentCollectionService
  extends ISourceOfFundsDocumentCollectionBuyerService,
    ISourceOfFundsDocumentCollectionStaffService {}
