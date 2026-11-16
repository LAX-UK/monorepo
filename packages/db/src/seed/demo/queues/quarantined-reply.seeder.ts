import * as schema from "../../../schema/index.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_IDS } from "./queue-ids.js";

const HOUR = 3_600_000;

/** Enquiries: an emailed reply from an address that does not match the enquirer, held for staff. */
export const quarantinedReplySeeder: QueueSeeder = {
  queue: "Quarantined enquiry replies",
  async seed({ db, now, enquiryIds }: QueueContext) {
    const receivedAt = new Date(now - 5 * HOUR);
    await db
      .insert(schema.enquiryInboundQuarantine)
      .values({
        id: QUEUE_IDS.quarantine(1),
        providerMessageId: "demo-inbound-0001@example.test",
        reason: "sender_mismatch",
        fromAddress: "assistant@example.com",
        subject: "Re: Your private sales enquiry",
        body: "Hello, I am replying on behalf of the buyer. Please send the details to me. (Demo message.)",
        suspectedEnquiryId: enquiryIds.buy,
        receivedAt,
        purgeAt: new Date(now + 25 * 24 * HOUR),
      })
      .onConflictDoNothing();
  },
};
