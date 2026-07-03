import type { Database } from "@auction/db";
import type { ISourceOfFundsDocumentReviewRepository } from "../../repositories/drizzle-source-of-funds-document-review.repository.js";
import type { ISourceOfFundsDocumentRepository } from "../../repositories/drizzle-source-of-funds-document.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IObjectStorage } from "../interfaces/object-storage.js";
import type { ISignedUrlPolicy } from "../signed-url-policy.js";
import type { SourceOfFundsSettlementReadService } from "./source-of-funds-settlement-read.service.js";
import type { ISourceOfFundsRepository } from "./source-of-funds.types.js";

export type SourceOfFundsDocumentCollectionContext = {
  caseRepo: ISourceOfFundsRepository;
  docRepo: ISourceOfFundsDocumentRepository;
  reviewRepo: ISourceOfFundsDocumentReviewRepository;
  db: Database;
  events: DomainEventPublisher | null;
  storage: IObjectStorage;
  downloadSigningPolicy: ISignedUrlPolicy;
  settlementRead: SourceOfFundsSettlementReadService;
};

export function createSourceOfFundsDocumentCollectionContext(input: {
  caseRepo: ISourceOfFundsRepository;
  docRepo: ISourceOfFundsDocumentRepository;
  reviewRepo: ISourceOfFundsDocumentReviewRepository;
  db: Database;
  events: DomainEventPublisher | null;
  storage: IObjectStorage;
  downloadSigningPolicy: ISignedUrlPolicy;
  settlementRead: SourceOfFundsSettlementReadService;
}): SourceOfFundsDocumentCollectionContext {
  return input;
}

export const SOURCE_OF_FUNDS_DOCUMENTS_REQUESTED_EVENT = "source_of_funds.documents_requested";
export const SOURCE_OF_FUNDS_DOCUMENTS_SUBMITTED_EVENT = "source_of_funds.documents_submitted";
export const SOURCE_OF_FUNDS_DOCUMENT_UPLOADED_EVENT = "source_of_funds.document_uploaded";
export const SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT = "source_of_funds.document_downloaded";

const STAFF_PREVIEW_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Defense-in-depth: only serve inline preview for PDF/images. */
export function clampStaffPreviewContentType(raw: string): string {
  const normalized = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized === "image/jpg") return "image/jpeg";
  return STAFF_PREVIEW_CONTENT_TYPES.has(normalized) ? normalized : "application/octet-stream";
}

export function sanitizeSourceOfFundsFilename(name: string): string {
  return name.replace(/[^\w\s.-]/g, "_").slice(0, 200) || "document";
}
