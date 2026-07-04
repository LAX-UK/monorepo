import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { IComplianceRecipientReader } from "../../interfaces/compliance-recipient.reader.js";
import type { ISourceOfFundsDocumentsTaskRepository } from "../../interfaces/source-of-funds-projector.repository.js";
import type { DocumentsSubmittedPayload } from "./sof-documents-helpers.js";

export async function handleDocumentsSubmitted(args: {
  sourceOfFundsDocumentsTaskRepo: ISourceOfFundsDocumentsTaskRepository;
  log: pino.Logger;
  complianceRecipientReader: IComplianceRecipientReader;
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  adminReviewUrl: string;
  adminEmailAddress?: string | undefined;
  payload: DocumentsSubmittedPayload;
  sourceOfFundsId: string;
  eventId: number;
}): Promise<void> {
  const sourceOfFundsId = args.payload.sourceOfFundsId ?? args.sourceOfFundsId;

  await args.sourceOfFundsDocumentsTaskRepo.reopenResolvedReviewTask(sourceOfFundsId);

  if (!args.emailService || !args.supportContactEmail) return;

  const detail = `Buyer submitted ${args.payload.documentCount ?? "new"} document(s) for review`;
  const recipients = await args.complianceRecipientReader.listRecipients();
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
