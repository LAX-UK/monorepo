import { describe, expect, it, vi } from "vitest";
import type { PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
import { expireShopCheckoutSession } from "./drizzle-payment-event.processor.js";

const sweepAt = new Date("2026-11-10T12:00:00Z");

/** A database whose order reads come back one after another, as the order changes under the sweep. */
function dbReading(reads: Array<Record<string, unknown>>) {
  const limit = vi.fn();
  for (const read of reads) limit.mockResolvedValueOnce([read]);
  const transaction = vi.fn();
  const db = { select: () => ({ from: () => ({ where: () => ({ limit }) }) }), transaction };
  return { db: db as never, transaction };
}

function gatewayThatExpires() {
  const expireHostedCheckout = vi.fn(async () => ({ kind: "expired" as const }));
  const gateway = { expireHostedCheckout } as unknown as PaymentCheckoutGateway;
  return { gateway, expireHostedCheckout };
}

describe("ending a checkout session in the sweep", () => {
  it("leaves a session alone when the buyer opened a new one after the sweep chose the order", async () => {
    const { gateway, expireHostedCheckout } = gatewayThatExpires();
    const { db, transaction } = dbReading([
      // Read for the session to end: payment was opened in between, with a new session and hold.
      {
        status: "pending_payment",
        stripeCheckoutSessionId: "cs_new",
        checkoutExpiresAt: new Date(sweepAt.getTime() + 30 * 60_000),
      },
    ]);

    const outcome = await expireShopCheckoutSession(
      db,
      { eventId: "reaper:order:o1", orderId: "o1", holdMustHaveEndedBy: sweepAt },
      { paymentGateway: gateway },
    );

    expect(outcome).toBe("unchanged");
    expect(expireHostedCheckout).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("ends the session it read when the hold has ended", async () => {
    const { gateway, expireHostedCheckout } = gatewayThatExpires();
    const ended = new Date(sweepAt.getTime() - 60_000);
    const { db, transaction } = dbReading([
      { status: "pending_payment", stripeCheckoutSessionId: "cs_old", checkoutExpiresAt: ended },
    ]);
    transaction.mockResolvedValue("expired");

    const outcome = await expireShopCheckoutSession(
      db,
      { eventId: "reaper:order:o1", orderId: "o1", holdMustHaveEndedBy: sweepAt },
      { paymentGateway: gateway },
    );

    expect(outcome).toBe("expired");
    expect(expireHostedCheckout).toHaveBeenCalledWith({ orderId: "o1", sessionId: "cs_old" });
  });
});
