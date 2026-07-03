import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { transactionRunnerFromDb } from "../../../test/transaction-runner-from-db.js";
import type { IPayoutService } from "../../interfaces/payout.js";
import { ConnectTransferWebhookService } from "./connect-transfer-webhook.service.js";

vi.mock("../../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn().mockResolvedValue({ claimed: true }),
}));

function makeTransactionDb(inner: Database = {} as Database): Database {
  return {
    transaction: vi.fn(async (fn: (tx: Database) => Promise<unknown>) => fn(inner)),
  } as unknown as Database;
}

describe("ConnectTransferWebhookService", () => {
  it("ignores unsupported event types", async () => {
    const payoutService = {
      reconcileStripeTransfer: vi.fn(),
    } as unknown as IPayoutService;
    const svc = new ConnectTransferWebhookService(
      transactionRunnerFromDb(makeTransactionDb()),
      payoutService,
    );

    const result = await svc.handleTransferEvent({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: {} },
    } as never);

    expect(result).toEqual({ processed: false });
    expect(payoutService.reconcileStripeTransfer).not.toHaveBeenCalled();
  });

  it("no-ops transfer.updated without reconciling", async () => {
    const reconcileStripeTransfer = vi.fn();
    const payoutService = { reconcileStripeTransfer } as unknown as IPayoutService;
    const svc = new ConnectTransferWebhookService(
      transactionRunnerFromDb(makeTransactionDb()),
      payoutService,
    );

    const result = await svc.handleTransferEvent({
      id: "evt_2",
      type: "transfer.updated",
      data: { object: { id: "tr_1", metadata: {} } },
    } as never);

    expect(result).toEqual({ processed: true });
    expect(reconcileStripeTransfer).not.toHaveBeenCalled();
  });
});
