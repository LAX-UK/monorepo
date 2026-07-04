import { sourceOfFunds, user } from "@auction/db";
import type { IEmailService } from "@auction/email";
import type { INotificationWriteRepository } from "@auction/persistence/interfaces";
import { eq } from "drizzle-orm";
import type pino from "pino";
import type { Db } from "../lib/projector.types.js";
import { type ReviewedPayload, loadSettlementContext } from "./sof-documents-helpers.js";

export async function handleReviewedClosure(args: {
  db: Db;
  notificationWriteRepo: INotificationWriteRepository;
  log: pino.Logger;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  buyerSofUrl: string;
  payload: ReviewedPayload;
  sourceOfFundsId: string;
  eventId: number;
}): Promise<void> {
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

  await args.notificationWriteRepo.createMany([
    {
      userId: buyerId,
      type: notifType,
      title,
      message,
    },
  ]);

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
