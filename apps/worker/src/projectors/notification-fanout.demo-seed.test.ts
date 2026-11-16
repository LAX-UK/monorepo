import type { IEmailService } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { NOTIFICATION_FANOUT_PROJECTOR, processNotificationFanout } from "./notification-fanout.js";

const log = pino({ level: "silent" });

const unappliedMoney = {
  reason: "customer_balance_unapplied",
  paymentId: null,
  paymentGroupId: null,
  stripePaymentIntentId: null,
  stripeChargeId: null,
  stripeCustomerId: "cus_demo_example",
  stripeEventId: "evt_demo_example_unapplied_0001:gbp",
  amountCents: 250_000,
  currency: "GBP",
  dedupeKey: "customer_balance_unapplied:evt_demo_example_unapplied_0001:gbp",
};

describe("notification fanout and demo seed events", () => {
  it("emails no finance staff about unapplied money the demo seed recorded, and moves past it", async () => {
    const enqueue = vi.fn();
    const listFinance = vi.fn().mockResolvedValue([{ email: "finance@example.test" }]);
    const advanceCursor = vi.fn();
    const ctx = {
      projectorStateRepo: { getCursor: vi.fn().mockResolvedValue(10), advanceCursor },
      domainEventReader: {
        listAfterCursor: vi.fn().mockResolvedValue([
          {
            id: 11,
            eventType: "payment.unapplied_money_received",
            aggregateId: unappliedMoney.dedupeKey,
            payload: unappliedMoney,
            producer: "demo-seed",
          },
        ]),
      },
      projectorFailureRecorder: { record: vi.fn() },
      notificationFanoutReader: {},
      staffOpsRecipientReader: new Proxy({}, { get: () => listFinance }),
      adminEmailAddress: "admin@example.test",
    } as unknown as ProjectorRunContext;

    await processNotificationFanout({
      ctx,
      log,
      emailService: { enqueue } as unknown as IEmailService,
      supportContactEmail: "support@example.test",
      adminPayoutsUrl: "https://example.test/admin/payouts",
    });

    expect(listFinance).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(advanceCursor).toHaveBeenCalledWith(NOTIFICATION_FANOUT_PROJECTOR, 11);
  });
});
