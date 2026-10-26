import type { OrderProblemReason } from "@auction/shop-contracts";
import type { EnquirySender } from "../enquiry-sender.js";

/** Sends a problem reported on an order to the staff enquiry inbox. */
export interface OrderProblemReportWriter {
  submit(input: {
    sender: EnquirySender;
    orderReference: string;
    reason: OrderProblemReason;
    details: string;
  }): Promise<{ reportId: string }>;
}
