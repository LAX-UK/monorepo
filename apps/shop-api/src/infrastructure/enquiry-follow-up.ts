import type { Database } from "@auction/db";
import { guestLeadSourceForEnquiry } from "@auction/shop-domain";
import type { EnquiryFollowUp } from "../application/ports/enquiry-follow-up.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { recordGuestEnquiryLead } from "./guest-checkout/guest-lead-events.js";
import type { ShopDomainEventPublisherMode } from "./shop-domain-event-publisher.js";

/**
 * After an enquiry is stored: a guest becomes a lead, and the sender gets their copy. A problem
 * reported on a Shop order is its own flow with its own emails, so it gets neither.
 */
export function createEnquiryFollowUp(options: {
  notifications: ShopNotificationPublisher | null;
  domainEventMode: ShopDomainEventPublisherMode;
}): EnquiryFollowUp {
  return {
    async afterStored(tx, enquiry, now) {
      if (enquiry.topic === "order_problem") return;
      const db = tx as Database;
      if (enquiry.sender.kind === "guest") {
        await recordGuestEnquiryLead(
          db,
          {
            email: enquiry.sender.contactEmail,
            name: enquiry.sender.contactName,
            phone: enquiry.phone,
            source: guestLeadSourceForEnquiry(enquiry.salesChannel),
            at: now,
          },
          options.domainEventMode,
        );
      }
      await options.notifications?.queueEnquiryAcknowledgement(tx, {
        idempotencyKey: `enquiry-received:${enquiry.reference}`,
        sender: enquiry.sender,
        reference: enquiry.reference,
        storefront: enquiry.salesChannel,
        topic: enquiry.topic,
        ...(enquiry.topic === "artwork"
          ? { artworkTitle: enquiry.artworkTitle, artworkUrl: enquiry.artworkUrl }
          : {}),
      });
    },
  };
}
