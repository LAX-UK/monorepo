import type { Database } from "@auction/db";
import type { PaymentRefundGateway } from "../../application/ports/payment-refund.gateway.js";
import { createSubmitPendingRefundsRunner } from "../../infrastructure/scheduler/submit-pending-refunds.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createRefundSubmissionTask(
  db: Database,
  gateway: PaymentRefundGateway,
  opsAlertEmail?: string | null,
): ShopSchedulerTask {
  const submit = createSubmitPendingRefundsRunner(db, gateway, {
    ...(opsAlertEmail !== undefined ? { opsAlertEmail } : {}),
  });
  return {
    name: "refund-submission",
    run: async () => {
      await submit();
    },
  };
}
