import { describe, expect, it, vi } from "vitest";
import { LifecycleCronService } from "./lifecycle-cron.service.js";
import { PaymentMaintenanceCronService } from "./payment-maintenance-cron.service.js";

describe("PaymentMaintenanceCronService", () => {
  it("delegates expire and refund replay", async () => {
    const maintenance = {
      expireStalePendingPayments: vi.fn().mockResolvedValue(2),
    };
    const refund = {
      replayPending: vi.fn().mockResolvedValue({ attempted: 1, reconciled: 1 }),
    };
    const svc = new PaymentMaintenanceCronService(maintenance, refund);
    await expect(svc.expireStalePayments(14, 30)).resolves.toEqual({ expired: 2 });
    expect(maintenance.expireStalePendingPayments).toHaveBeenCalledWith(14, 30);
    await expect(svc.retryRefundReconciles()).resolves.toEqual({ attempted: 1, reconciled: 1 });
    expect(refund.replayPending).toHaveBeenCalledWith(25);
  });
});

describe("LifecycleCronService", () => {
  it("runs lifecycle tick and outbox batch", async () => {
    const lot = { runTransitions: vi.fn().mockResolvedValue(undefined) };
    const sale = { reconcileSaleStatuses: vi.fn().mockResolvedValue(undefined) };
    const outbox = {
      processBatch: vi.fn().mockResolvedValue({ processed: 1, failed: 0, pendingDepth: 0 }),
    };
    const svc = new LifecycleCronService(lot, sale, outbox);
    await expect(svc.runLotLifecycleTick()).resolves.toEqual({ ok: true });
    expect(lot.runTransitions).toHaveBeenCalled();
    expect(sale.reconcileSaleStatuses).toHaveBeenCalled();
    await svc.processNotificationOutbox();
    expect(outbox.processBatch).toHaveBeenCalledWith(50);
  });
});
