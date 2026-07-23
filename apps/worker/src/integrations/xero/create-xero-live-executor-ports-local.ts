import type { AccountingReplayCronService } from "@auction/finance-cron-app";
import type { XeroAccountingStack } from "@auction/finance-runtime";
import { XeroLiveExecutorError, type XeroLiveExecutorPorts } from "./xero-live-executor.js";

export function createXeroLiveExecutorPortsFromStack(
  stack: Pick<XeroAccountingStack, "accountingReplayCronService" | "xeroPayoutBillWriter">,
  ensureLotInvoice?: (lotId: string) => Promise<void>,
): XeroLiveExecutorPorts {
  const replay = stack.accountingReplayCronService;

  return {
    recordStripeCapture: async (paymentId) => {
      const result = await replay.recordStripeCaptureForPayment(paymentId);
      if (!result.ok) {
        throw new XeroLiveExecutorError(result.error ?? "xero_record_stripe_capture_failed", false);
      }
    },
    recordRefundCreditNote: async (paymentId) => {
      const result = await replay.recordRefundCreditNoteForPayment(paymentId);
      if (!result.ok) {
        throw new XeroLiveExecutorError(
          result.error ?? "xero_record_refund_credit_note_failed",
          false,
        );
      }
    },
    ensureLotInvoice: async (lotId) => {
      if (ensureLotInvoice) {
        await ensureLotInvoice(lotId);
        return;
      }
      throw new XeroLiveExecutorError("ensure_lot_invoice_handler_missing", false);
    },
    syncPayoutBill: async (payoutId) => {
      const writer = stack.xeroPayoutBillWriter;
      if (!writer) {
        throw new XeroLiveExecutorError("xero_payout_bill_disabled", false);
      }
      const outcome = await writer.syncPaidPayout(payoutId);
      if (!outcome.ok) {
        throw new XeroLiveExecutorError(outcome.error ?? "xero_payout_bill_failed", true);
      }
    },
    acknowledgePayoutSettlement: async (payoutId) => {
      const result = await replay.acknowledgePayoutSettlement(payoutId);
      if (!result.ok) {
        throw new XeroLiveExecutorError(result.error ?? "xero_acknowledge_payout_failed", false);
      }
    },
  };
}

export async function syncXeroInvoiceWebhookLocal(
  replay: AccountingReplayCronService,
  input: { tenantId: string; resourceId: string; eventKey: string },
): Promise<void> {
  const result = await replay.syncXeroInvoiceWebhookEvent(input);
  if (!result.ok && !result.skipped) {
    throw new XeroLiveExecutorError(result.error ?? "xero_sync_invoice_webhook_failed", true);
  }
}
