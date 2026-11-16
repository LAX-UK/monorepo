import type { IEmailService } from "@auction/email";
import type { MarketingEnquiryRecord } from "@auction/persistence/interfaces";
import type { InboundEnquiryTarget } from "@auction/persistence/interfaces";
import type { IEnquiryReplyAlert } from "./enquiry-inbound-reply.service.js";
import type { IMarketingEnquiryAlert } from "./marketing-enquiry-alert.js";
import { enquiryTopicLabel } from "./marketing-enquiry.service.js";

export type EmailMarketingEnquiryAlertDeps = {
  email: IEmailService;
  /** The staff inbox, `BID_ENQUIRY_NOTIFICATION_EMAIL`. */
  inbox: string;
  /** The web origin, for the link to the enquiry in the staff admin. */
  webOrigin: string;
};

/** Sends the enquiry to the staff inbox through the email outbox, once per enquiry. */
export class EmailMarketingEnquiryAlert implements IMarketingEnquiryAlert, IEnquiryReplyAlert {
  constructor(private readonly deps: EmailMarketingEnquiryAlertDeps) {}

  async notify(enquiry: MarketingEnquiryRecord): Promise<void> {
    const origin = this.deps.webOrigin.replace(/\/$/, "");
    await this.deps.email.enqueue({
      template: "marketing-enquiry-alert",
      to: this.deps.inbox,
      category: "transactional",
      idempotencyKey: `marketing-enquiry-alert:${enquiry.id}`,
      vars: {
        topicLabel: enquiryTopicLabel(enquiry.topic),
        name: enquiry.name,
        senderEmail: enquiry.email,
        ...(enquiry.phone ? { phone: enquiry.phone } : {}),
        message: enquiry.message,
        ...(enquiry.sourcePage ? { sourcePage: enquiry.sourcePage } : {}),
        adminEnquiryUrl: `${origin}/admin/enquiries/${enquiry.id}`,
      },
    });
  }

  /** Tells the staff inbox that the sender replied by email, once per reply. */
  async notifyReply(
    enquiry: InboundEnquiryTarget,
    reply: { messageId: string; text: string },
  ): Promise<void> {
    const origin = this.deps.webOrigin.replace(/\/$/, "");
    await this.deps.email.enqueue({
      template: "marketing-enquiry-alert",
      to: this.deps.inbox,
      category: "transactional",
      idempotencyKey: `marketing-enquiry-reply-alert:${reply.messageId}`,
      vars: {
        topicLabel: `Reply to ${enquiry.reference}`,
        name: enquiry.name,
        senderEmail: enquiry.email,
        message: reply.text.slice(0, 2000),
        adminEnquiryUrl: `${origin}/admin/enquiries/${enquiry.id}`,
      },
    });
  }
}
