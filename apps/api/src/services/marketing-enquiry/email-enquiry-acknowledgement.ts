import type { IEmailService } from "@auction/email";
import type { MarketingEnquiryRecord } from "@auction/persistence/interfaces";
import type {
  EnquiryAcknowledgementSummary,
  IEnquiryAcknowledgement,
} from "./enquiry-acknowledgement.js";
import { replyDueAt } from "./enquiry-view.js";

export type EmailEnquiryAcknowledgementDeps = {
  email: Pick<IEmailService, "enqueue">;
  /** The web origin, for the privacy notice link. */
  webOrigin: string;
  /** Where the sender writes to add something. */
  contactEmail: string;
};

/** Queues the sender's copy through the email outbox, once per enquiry. */
export class EmailEnquiryAcknowledgement implements IEnquiryAcknowledgement {
  constructor(private readonly deps: EmailEnquiryAcknowledgementDeps) {}

  async send(
    enquiry: MarketingEnquiryRecord,
    summary: EnquiryAcknowledgementSummary,
  ): Promise<void> {
    const origin = this.deps.webOrigin.replace(/\/$/, "");
    await this.deps.email.enqueue({
      template: "bid-enquiry-received",
      to: enquiry.email,
      category: "transactional",
      idempotencyKey: `bid-enquiry-received:${enquiry.id}`,
      vars: {
        reference: enquiry.reference,
        recipientName: enquiry.name,
        kind: summary.kind,
        ...(summary.topicLabel ? { topicLabel: summary.topicLabel } : {}),
        ...(summary.departmentLabel ? { departmentLabel: summary.departmentLabel } : {}),
        ...(summary.work ? { work: summary.work } : {}),
        photoCount: summary.photoCount,
        replyBy: replyDueAt(enquiry),
        privacyUrl: `${origin}/privacy`,
        contactEmail: this.deps.contactEmail,
      },
    });
  }
}
