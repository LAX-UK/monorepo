import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import { describe, expect, it } from "vitest";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import { fanoutPaymentFailed } from "./payment-failed-fanout.js";

function harness(buyer: { email: string; name: string; firstName: string | null } | null) {
  const sent: EmailEnqueueInput<TemplateName>[] = [];
  const emailService: IEmailService = {
    async enqueue(input) {
      sent.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a" };
    },
  };
  const notificationFanoutReader = {
    getUserForProxyNotice: async () => buyer,
    getLotTitle: async () => "Harbour at Dusk",
  } as unknown as INotificationFanoutReader;
  return {
    sent,
    deps: {
      emailService,
      notificationFanoutReader,
      supportContactEmail: "help@lax.bid",
      webOrigin: "https://lax.bid",
    },
  };
}

const SAM = { email: "sam@example.com", name: "Sam Lee", firstName: "Sam" };

describe("fanoutPaymentFailed", () => {
  it("tells the buyer the payment failed and links to checkout for that lot", async () => {
    const { sent, deps } = harness(SAM);
    await fanoutPaymentFailed({
      ...deps,
      eventId: 21,
      payload: {
        lotId: "lot-1",
        buyerUserId: "sam",
        reason: "stripe_checkout_async_payment_failed",
      },
    });
    expect(sent).toEqual([
      expect.objectContaining({
        template: "payment-failed-notice",
        to: "sam@example.com",
        idempotencyKey: "payment-failed-notice:21:sam",
        vars: expect.objectContaining({
          lotTitle: "Harbour at Dusk",
          payUrl: "https://lax.bid/purchases/checkout/lot-1",
        }),
      }),
    ]);
  });

  it.each(["buyer_cancelled", "checkout_expired", undefined])(
    "does not announce a cancellation for %s",
    async (reason) => {
      const { sent, deps } = harness(SAM);
      await fanoutPaymentFailed({
        ...deps,
        eventId: 22,
        payload: { lotId: "lot-1", buyerUserId: "sam", ...(reason ? { reason } : {}) },
      });
      expect(sent).toEqual([]);
    },
  );

  it("sends nothing when the buyer has no email on record", async () => {
    const { sent, deps } = harness(null);
    await fanoutPaymentFailed({
      ...deps,
      eventId: 23,
      payload: {
        lotId: "lot-1",
        buyerUserId: "sam",
        reason: "stripe_checkout_async_payment_failed",
      },
    });
    expect(sent).toEqual([]);
  });
});
