import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IErrorReporter } from "../interfaces/error-handling.js";

/**
 * Runs what follows a committed capture (receipt, fulfilment, accounting, closing other
 * checkouts). The money is already recorded and the webhook's event already claimed, so a failure
 * here must not fail the webhook: Stripe's redelivery would be skipped as a duplicate and the
 * work would never run. The failure is reported (error severity, with a money-path metric) so
 * staff see the capture that is missing its follow-ups, and the webhook still answers success.
 */
export async function runAfterCapture(
  run: (() => Promise<void>) | undefined,
  context: { paymentId?: string; paymentGroupId?: string },
  reporter: IErrorReporter | undefined,
): Promise<void> {
  if (!run) return;
  try {
    await run();
  } catch (cause) {
    recordMoneyPathEvent("payment_after_capture_failed");
    const subject = context.paymentId
      ? `payment ${context.paymentId}`
      : `payment group ${context.paymentGroupId ?? "unknown"}`;
    const classified = {
      message: `The capture of ${subject} was recorded, but its receipt or follow-up steps failed`,
      status: 500,
      code: "payment_after_capture_failed",
      severity: "error" as const,
      cause,
    };
    if (reporter) reporter.report(classified);
    else console.error(JSON.stringify({ msg: classified.code, ...context }));
  }
}
