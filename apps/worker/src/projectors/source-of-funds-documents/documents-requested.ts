import { notification, user } from "@auction/db";
import type { IEmailService } from "@auction/email";
import { eq } from "drizzle-orm";
import type pino from "pino";
import type { Db } from "../lib/projector.types.js";
import { type DocumentsRequestedPayload, loadSettlementContext } from "./sof-documents-helpers.js";

export async function handleDocumentsRequested(args: {
  db: Db;
  log: pino.Logger;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  buyerSofUrl: string;
  payload: DocumentsRequestedPayload;
  sourceOfFundsId: string;
  eventId: number;
}): Promise<void> {
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
