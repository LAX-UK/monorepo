import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { handleDocumentsRequested } from "./source-of-funds-documents/documents-requested.js";
import { handleDocumentsSubmitted } from "./source-of-funds-documents/documents-submitted.js";
import { handleReviewedClosure } from "./source-of-funds-documents/reviewed-closure.js";
import type {
  DocumentsRequestedPayload,
  DocumentsSubmittedPayload,
  ReviewedPayload,
} from "./source-of-funds-documents/sof-documents-helpers.js";

export const SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR = "source_of_funds_documents";

const SOF_DOCUMENT_EVENT_TYPES = [
  "source_of_funds.documents_requested",
  "source_of_funds.documents_submitted",
  "source_of_funds.reviewed",
] as const;

export async function processSourceOfFundsDocuments(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const {
    projectorStateRepo,
    domainEventReader,
    projectorFailureRecorder,
    notificationWriteRepo,
    emailService,
    supportContactEmail,
    webOrigin,
    adminEmailAddress,
    complianceRecipientReader,
    sourceOfFundsSettlementReader,
    sourceOfFundsBuyerReader,
    sourceOfFundsDocumentsTaskRepo,
  } = ctx;
  const base = webOrigin?.replace(/\/$/, "") ?? "";
  const buyerSofUrl = `${base}/dashboard/compliance/source-of-funds`;
  const adminReviewUrl = `${base}/admin/compliance/source-of-funds`;

  const cursor = await projectorStateRepo.getCursor(SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [...SOF_DOCUMENT_EVENT_TYPES],
    limit: 50,
  });

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      if (row.eventType === "source_of_funds.documents_requested") {
        await handleDocumentsRequested({
          sourceOfFundsBuyerReader,
          sourceOfFundsSettlementReader,
          notificationWriteRepo,
          log,
          emailService,
          supportContactEmail,
          buyerSofUrl,
          payload: (row.payload ?? {}) as DocumentsRequestedPayload,
          sourceOfFundsId: row.aggregateId,
          eventId: row.id,
        });
      } else if (row.eventType === "source_of_funds.documents_submitted") {
        await handleDocumentsSubmitted({
          sourceOfFundsDocumentsTaskRepo,
          log,
          complianceRecipientReader,
          emailService,
          supportContactEmail,
          adminReviewUrl,
          adminEmailAddress,
          payload: (row.payload ?? {}) as DocumentsSubmittedPayload,
          sourceOfFundsId: row.aggregateId,
          eventId: row.id,
        });
      } else if (row.eventType === "source_of_funds.reviewed") {
        await handleReviewedClosure({
          sourceOfFundsSettlementReader,
          sourceOfFundsBuyerReader,
          notificationWriteRepo,
          log,
          emailService,
          supportContactEmail,
          buyerSofUrl,
          payload: (row.payload ?? {}) as ReviewedPayload,
          sourceOfFundsId: row.aggregateId,
          eventId: row.id,
        });
      }
      maxId = row.id;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
        log,
        projectorName: SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR,
        eventId: row.id,
        err,
      });
      if (outcome.action === "skip") {
        maxId = row.id;
        continue;
      }
      return;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR, maxId);
  }
}
