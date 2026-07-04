import type { IEmailService } from "@auction/email";
import type { INotificationWriteRepository } from "@auction/persistence/interfaces";
import type pino from "pino";
import type {
  ISourceOfFundsBuyerReader,
  ISourceOfFundsSettlementReader,
} from "../../interfaces/source-of-funds-projector.repository.js";
import type { ReviewedPayload } from "./sof-documents-helpers.js";

export async function handleReviewedClosure(args: {
  sourceOfFundsSettlementReader: ISourceOfFundsSettlementReader;
  sourceOfFundsBuyerReader: ISourceOfFundsBuyerReader;
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

  const status = await args.sourceOfFundsSettlementReader.getCaseStatus(args.sourceOfFundsId);
  if (status !== "approved" && status !== "rejected") return;

  const buyerRow = await args.sourceOfFundsBuyerReader.getBuyerContact(buyerId);
  if (!buyerRow?.email) return;

  const settlement = await args.sourceOfFundsSettlementReader.loadSettlementContext(buyerId);
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
