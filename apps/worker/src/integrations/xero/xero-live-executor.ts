import type pino from "pino";
import type { XeroProjectorCommand } from "./xero-command-projector.js";

export type XeroLiveExecutorPorts = {
  recordStripeCapture: (paymentId: string) => Promise<void>;
  recordRefundCreditNote: (paymentId: string) => Promise<void>;
  ensureLotInvoice: (lotId: string) => Promise<void>;
  syncPayoutBill: (payoutId: string) => Promise<void>;
  acknowledgePayoutSettlement: (payoutId: string) => Promise<void>;
};

export class XeroLiveExecutorError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "XeroLiveExecutorError";
  }
}

export async function executeXeroLiveCommand(
  ports: XeroLiveExecutorPorts,
  command: XeroProjectorCommand,
  log: pino.Logger,
): Promise<void> {
  switch (command.operation) {
    case "payment_captured":
      await ports.recordStripeCapture(command.aggregateId);
      return;
    case "payment_refunded":
      await ports.recordRefundCreditNote(command.aggregateId);
      return;
    case "lot_invoice":
      await ports.ensureLotInvoice(command.aggregateId);
      return;
    case "payout_bill":
      await ports.syncPayoutBill(command.aggregateId);
      return;
    case "payout_settlement":
      await ports.acknowledgePayoutSettlement(command.aggregateId);
      return;
    default: {
      const _exhaustive: never = command.operation;
      log.warn({ operation: _exhaustive }, "xero_live_executor_unknown_operation");
    }
  }
}
