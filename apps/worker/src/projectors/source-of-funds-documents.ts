import {
  adminReviewTask,
  domainEvent,
  notification,
  projectorState,
  sourceOfFunds,
  user,
} from "@auction/db";
import type { IEmailService } from "@auction/email";
import { and, eq, gt, sql } from "drizzle-orm";
import type pino from "pino";
import { listComplianceRecipients } from "../lib/compliance-email-recipients.js";
import { recordProjectorEventFailure } from "./lib/projector-failure-guard.js";

export const SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR = "source_of_funds_documents";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type DocumentsRequestedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  documentTypes?: string[];
  note?: string | null;
};

type DocumentsSubmittedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  documentCount?: number;
};

type ReviewedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  status?: string;
};

/**
 * Projects SoF document lifecycle events: buyer notification on request,
 * staff alert on submit, buyer closure on approve/reject.
 */
export async function processSourceOfFundsDocuments(options: {
  db: Db;
  log: pino.Logger;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  webOrigin?: string | undefined;
  adminEmailAddress?: string | undefined;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail, webOrigin, adminEmailAddress } = options;
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

async function handleDocumentsRequested(args: {
  db: Db;
  log: pino.Logger;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  buyerSofUrl: string;
  payload: DocumentsRequestedPayload;
  sourceOfFundsId: string;
  eventId: number;
}) {
  const buyerId = args.payload.userId;
  if (!buyerId) return;

  const [buyerRow] = await args.db
    .select({ email: user.email, firstName: user.firstName })
    .from(user)
    .where(eq(user.id, buyerId))
    .limit(1);
  if (!buyerRow?.email) return;

  const types = args.payload.documentTypes ?? [];
  const settlement = await loadSettlementContext(args.db, buyerId);

  await args.db.insert(notification).values({
    userId: buyerId,
    type: "source_of_funds_documents_requested",
    title: "Documents requested for source of funds",
    message: settlement.summary
      ? `Please upload the requested documents for ${settlement.summary}.`
      : "Our compliance team has requested documents to verify your source of funds.",
  });

  if (args.emailService && args.supportContactEmail) {
    await args.emailService.enqueue({
      template: "source-of-funds-documents-requested",
      to: buyerRow.email,
      userId: buyerId,
      vars: {
        userName: buyerRow.firstName ?? null,
        documentTypes: types,
        requestNote: args.payload.note ?? null,
        uploadUrl: args.buyerSofUrl,
        settlementSummary: settlement.summary,
        supportContactEmail: args.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `source-of-funds-documents-requested:${args.sourceOfFundsId}:${args.eventId}`,
    });
  }
}

async function handleDocumentsSubmitted(args: {
  db: Db;
  log: pino.Logger;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  adminReviewUrl: string;
  adminEmailAddress?: string | undefined;
  payload: DocumentsSubmittedPayload;
  sourceOfFundsId: string;
  eventId: number;
}) {
  const sourceOfFundsId = args.payload.sourceOfFundsId ?? args.sourceOfFundsId;

  const existing = await args.db
    .select({ id: adminReviewTask.id, status: adminReviewTask.status })
    .from(adminReviewTask)
    .where(
      and(
        eq(adminReviewTask.kind, "source_of_funds_review"),
        sql`${adminReviewTask.payload} ->> 'sourceOfFundsId' = ${sourceOfFundsId}`,
      ),
    )
    .limit(1);

  const task = existing[0];
  if (task && task.status === "resolved") {
    await args.db
      .update(adminReviewTask)
      .set({ status: "pending", resolvedAt: null, resolvedByUserId: null })
      .where(eq(adminReviewTask.id, task.id));
  }

  if (!args.emailService || !args.supportContactEmail) return;

  const detail = `Buyer submitted ${args.payload.documentCount ?? "new"} document(s) for review`;
  const recipients = await listComplianceRecipients(args.db);
  const targets =
    recipients.length > 0
      ? recipients
      : args.adminEmailAddress
        ? [{ id: "admin", email: args.adminEmailAddress, firstName: "Compliance" }]
        : [];

  for (const r of targets) {
    await args.emailService.enqueue({
      template: "aml-compliance-review-notice",
      to: r.email,
      ...(r.id !== "admin" ? { userId: r.id } : { recipientResolution: "snapshot" as const }),
      vars: {
        recipientFirstName: r.firstName,
        kind: "source_of_funds",
        caseReference: sourceOfFundsId,
        detail,
        adminReviewUrl: args.adminReviewUrl,
        supportContactEmail: args.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `aml-compliance-review-notice:sof-submitted:${sourceOfFundsId}:${r.id}:${args.eventId}`,
    });
  }
}

async function handleReviewedClosure(args: {
  db: Db;
  log: pino.Logger;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  buyerSofUrl: string;
  payload: ReviewedPayload;
  sourceOfFundsId: string;
  eventId: number;
}) {
  const buyerId = args.payload.userId;
  if (!buyerId) return;

  const [caseRow] = await args.db
    .select({ status: sourceOfFunds.status })
    .from(sourceOfFunds)
    .where(eq(sourceOfFunds.id, args.sourceOfFundsId))
    .limit(1);
  const status = caseRow?.status;
  if (status !== "approved" && status !== "rejected") return;

  const [buyerRow] = await args.db
    .select({ email: user.email, firstName: user.firstName })
    .from(user)
    .where(eq(user.id, buyerId))
    .limit(1);
  if (!buyerRow?.email) return;

  const settlement = await loadSettlementContext(args.db, buyerId);
  const notifType = status === "approved" ? "source_of_funds_approved" : "source_of_funds_rejected";
  const title =
    status === "approved" ? "Source of funds verified" : "Source of funds review outcome";
  const message =
    status === "approved"
      ? "Your source of funds has been verified. You can now complete checkout."
      : "We were unable to verify your source of funds. Please check your email for next steps.";

  await args.db.insert(notification).values({
    userId: buyerId,
    type: notifType,
    title,
    message,
  });

  if (args.emailService && args.supportContactEmail) {
    const template =
      status === "approved" ? "source-of-funds-approved" : "source-of-funds-rejected";
    await args.emailService.enqueue({
      template,
      to: buyerRow.email,
      userId: buyerId,
      vars: {
        userName: buyerRow.firstName ?? null,
        settlementSummary: settlement.summary,
        dashboardUrl: args.buyerSofUrl,
        supportContactEmail: args.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `${template}:${args.sourceOfFundsId}:${args.eventId}`,
    });
  }
}

async function loadSettlementContext(db: Db, userId: string): Promise<{ summary: string | null }> {
  const [row] = await db
    .select({ exposureAmount: sourceOfFunds.exposureAmount, currency: sourceOfFunds.currency })
    .from(sourceOfFunds)
    .where(and(eq(sourceOfFunds.userId, userId), eq(sourceOfFunds.status, "pending")))
    .orderBy(sql`${sourceOfFunds.createdAt} DESC`)
    .limit(1);
  if (!row) return { summary: null };
  return { summary: `${row.currency} ${row.exposureAmount} exposure under review` };
}
