import type { Database } from "@auction/db";
import { shopGeneralEnquiry } from "@auction/db/schema";
import type { OrderProblemReason } from "@auction/shop-contracts";
import { type EnquirySender, enquirySenderColumns } from "../application/enquiry-sender.js";
import type { OrderProblemReportWriter } from "../application/ports/order-problem-report.port.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";

/** How the reason reads to staff in the inbox and the alert email. */
export const ORDER_PROBLEM_REASON_LABELS: Record<OrderProblemReason, string> = {
  changed_mind: "Changed their mind (14-day cancellation)",
  damaged: "Arrived damaged",
  wrong_item: "Wrong item",
  not_arrived: "Not arrived",
  other: "Something else",
};

/**
 * A problem reported from an order page goes to the staff enquiry inbox, under its own topic with
 * the order reference, and to the enquiries email when one is configured. Both happen together.
 */
export function createDrizzleOrderProblemReportWriter(
  db: Database,
  options: { notifications: ShopNotificationPublisher; opsEmail: string | null },
): OrderProblemReportWriter {
  return {
    async submit(input: {
      sender: EnquirySender;
      orderReference: string;
      reason: OrderProblemReason;
      details: string;
    }) {
      const message = `${ORDER_PROBLEM_REASON_LABELS[input.reason]}\n\n${input.details.trim()}`;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(shopGeneralEnquiry)
          .values({
            ...enquirySenderColumns(input.sender),
            topic: "order_problem",
            contextSlug: input.orderReference,
            message,
          })
          .returning({ id: shopGeneralEnquiry.id });
        if (!row) throw new Error("order problem report insert returned no row");
        const opsEmail = options.opsEmail?.trim();
        if (opsEmail) {
          await options.notifications.queueGeneralEnquiryAlert(tx, {
            idempotencyKey: `order-problem:${row.id}`,
            sender: input.sender,
            opsEmail,
            topic: "order_problem",
            contextSlug: input.orderReference,
            message,
            phone: null,
          });
        }
        return { reportId: row.id };
      });
    },
  };
}
