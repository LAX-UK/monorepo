import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import type { IPaymentRefundReconcileRepository } from "../../repositories/drizzle-payment-refund-reconcile.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPaymentWriteRepository } from "../interfaces/payment-write.js";
import { PaymentRefundReconcileService } from "./payment-refund-reconcile.service.js";

describe("PaymentRefundReconcileService", () => {
  it("marks reconciled only when payment status becomes refunded", async () => {
    const payments = {
      applyRefundedInTransaction: vi.fn().mockResolvedValue(true),
      findById: vi.fn().mockResolvedValue({ id: "pay-1", status: "refunded" }),
    } as unknown as IPaymentWriteRepository;
    const repo = {
      listPending: vi.fn().mockResolvedValue([
        {
          paymentId: "pay-1",
          stripeRefundId: "re_1",
          adminUserId: "admin-1",
          attempts: 0,
          payload: {
            sellerLegalEntityId: "le-1",
            amount: "100.00",
            via: "admin_manual",
          },
        },
      ]),
      markReconciled: vi.fn(),
      markFailed: vi.fn(),
    } as unknown as IPaymentRefundReconcileRepository;
    const db = {
      transaction: vi.fn(async (fn: (tx: Database) => Promise<void>) => fn({} as Database)),
    } as unknown as Database;
    const svc = new PaymentRefundReconcileService(
      db,
      payments,
      null,
      { publish: vi.fn() } as unknown as DomainEventPublisher,
      repo,
    );

    const result = await svc.replayPending(5);
    expect(result).toEqual({ attempted: 1, reconciled: 1 });
    expect(repo.markReconciled).toHaveBeenCalledWith("pay-1");
  });

  it("does not mark reconciled when applyRefundedInTransaction no-ops", async () => {
    const payments = {
      applyRefundedInTransaction: vi.fn().mockResolvedValue(false),
      findById: vi.fn().mockResolvedValue({ id: "pay-1", status: "pending" }),
    } as unknown as IPaymentWriteRepository;
    const repo = {
      listPending: vi.fn().mockResolvedValue([
        {
          paymentId: "pay-1",
          stripeRefundId: "re_1",
          adminUserId: "admin-1",
          attempts: 0,
          payload: {
            sellerLegalEntityId: "le-1",
            amount: "100.00",
            via: "admin_manual",
          },
        },
      ]),
      markReconciled: vi.fn(),
      markFailed: vi.fn(),
    } as unknown as IPaymentRefundReconcileRepository;
    const db = {
      transaction: vi.fn(async (fn: (tx: Database) => Promise<void>) => fn({} as Database)),
    } as unknown as Database;
    const svc = new PaymentRefundReconcileService(
      db,
      payments,
      null,
      { publish: vi.fn() } as unknown as DomainEventPublisher,
      repo,
    );

    const result = await svc.replayPending(5);
    expect(result).toEqual({ attempted: 1, reconciled: 0 });
    expect(repo.markReconciled).not.toHaveBeenCalled();
  });
});
