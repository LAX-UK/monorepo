import { domainEvent, projectorState } from "@auction/db";
import type { IEmailService } from "@auction/email";
import type { INotificationWriteRepository } from "@auction/persistence";
import { and, eq, gt, sql } from "drizzle-orm";
import type pino from "pino";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";
import { recordProjectorEventFailure } from "./lib/projector-failure-guard.js";
import { handleDocumentsRequested } from "./source-of-funds-documents/documents-requested.js";
import { handleDocumentsSubmitted } from "./source-of-funds-documents/documents-submitted.js";
import { handleReviewedClosure } from "./source-of-funds-documents/reviewed-closure.js";
import type {
  DocumentsRequestedPayload,
  DocumentsSubmittedPayload,
  ReviewedPayload,
} from "./source-of-funds-documents/sof-documents-helpers.js";

export const SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR = "source_of_funds_documents";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

/**
 * Projects SoF document lifecycle events: buyer notification on request,
 * staff alert on submit, buyer closure on approve/reject.
 */
export async function processSourceOfFundsDocuments(options: {
  db: Db;
  notificationWriteRepo: INotificationWriteRepository;
  log: pino.Logger;
  complianceRecipientReader: IComplianceRecipientReader;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  webOrigin?: string | undefined;
  adminEmailAddress?: string | undefined;
}): Promise<void> {
  const {
    db,
    notificationWriteRepo,
    log,
    emailService,
    supportContactEmail,
    webOrigin,
    adminEmailAddress,
    complianceRecipientReader,
  } = options;
  const base = webOrigin?.replace(/\/$/, "") ?? "";
  const buyerSofUrl = `${base}/dashboard/compliance/source-of-funds`;
  const adminReviewUrl = `${base}/admin/compliance/source-of-funds`;

  await db
    .insert(projectorState)
    .values({ projectorName: SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      eventType: domainEvent.eventType,
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(
      and(
        gt(domainEvent.id, cursor),
        sql`${domainEvent.eventType} IN (
          'source_of_funds.documents_requested',
          'source_of_funds.documents_submitted',
          'source_of_funds.reviewed'
        )`,
      ),
    )
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      if (row.eventType === "source_of_funds.documents_requested") {
        await handleDocumentsRequested({
          db,
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
          db,
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
          db,
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
      const outcome = await recordProjectorEventFailure({
        db,
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
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR));
  }
}
