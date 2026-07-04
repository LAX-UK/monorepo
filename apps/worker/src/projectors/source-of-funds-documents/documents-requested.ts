import type { IEmailService } from "@auction/email";
import type { INotificationWriteRepository } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { ISourceOfFundsBuyerReader } from "../../interfaces/source-of-funds-projector.repository.js";
import type { ISourceOfFundsSettlementReader } from "../../interfaces/source-of-funds-projector.repository.js";
import { type DocumentsRequestedPayload } from "./sof-documents-helpers.js";

export async function handleDocumentsRequested(args: {
  sourceOfFundsBuyerReader: ISourceOfFundsBuyerReader;
  sourceOfFundsSettlementReader: ISourceOfFundsSettlementReader;
  notificationWriteRepo: INotificationWriteRepository;
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

  const buyerRow = await args.sourceOfFundsBuyerReader.getBuyerContact(buyerId);
  if (!buyerRow?.email) return;

  const types = args.payload.documentTypes ?? [];
  const settlement = await args.sourceOfFundsSettlementReader.loadSettlementContext(buyerId);

  await args.notificationWriteRepo.createMany([
    {
      userId: buyerId,
      type: "source_of_funds_documents_requested",
      title: "Documents requested for source of funds",
      message: settlement.summary
        ? `Please upload the requested documents for ${settlement.summary}.`
        : "Our compliance team has requested documents to verify your source of funds.",
    },
  ]);

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
