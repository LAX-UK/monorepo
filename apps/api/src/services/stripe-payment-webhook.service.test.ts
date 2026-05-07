import type { Database } from "@auction/db";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IPayoutRepository } from "./interfaces/payout-repository.js";
import { StripePaymentWebhookService } from "./stripe-payment-webhook.service.js";

function mockDbWithPayment(paymentRow: {
  id: string;
  sellerLegalEntityId: string;
  status: string;
  amount: string;
}): Database {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([paymentRow]),
        }),
      }),
    }),
  } as unknown as Database;
}

describe("StripePaymentWebhookService.handleDisputeClosed", () => {
  it("creates an adjustment-only payout when a lost dispute has no open payout", async () => {
    const webhookEventRepository = {
      tryClaimEvent: vi.fn().mockResolvedValue({ claimed: true }),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const createdPayout = {
      id: "po_adjustment",
      legalEntityId: "00000000-0000-4000-8000-000000000001",
    };
    const payoutRepository = {
      findOpenPayoutForEntity: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(createdPayout),
      insertLine: vi.fn().mockResolvedValue({ id: "line_1" }),
    } as unknown as IPayoutRepository;
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const db = mockDbWithPayment({
      id: "pay_1",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000001",
      status: "captured",
      amount: "5000.00",
    });
    const svc = new StripePaymentWebhookService(
      db,
      webhookEventRepository,
      payoutRepository,
      publisher,
    );
    const event = { id: "evt_dispute_closed", type: "charge.dispute.closed" } as Stripe.Event;
    const dispute = {
      id: "dp_1",
      status: "lost",
      amount: 500000,
      currency: "gbp",
      charge: "ch_1",
    } as Stripe.Dispute;

    const result = await svc.handleDisputeClosed(event, dispute);

    expect(result).toEqual({ processed: true, action: "dispute_closed" });
    expect(payoutRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "00000000-0000-4000-8000-000000000001",
        grossAmount: "-5000.00",
        platformFee: "0.00",
        stripeFee: "0.00",
        netAmount: "-5000.00",
        currency: "GBP",
      }),
    );
    expect(payoutRepository.insertLine).toHaveBeenCalledWith({
      payoutId: "po_adjustment",
      paymentId: "pay_1",
      amount: "-5000.00",
      kind: "dispute",
      createdByUserId: null,
      note: "Dispute lost after paid payout: dp_1",
      sourceEventId: "evt_dispute_closed",
    });
    expect(publisher.publish).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        eventType: "payment.dispute_closed",
      }),
    );
    expect(webhookEventRepository.markProcessed).toHaveBeenCalledWith("stripe:evt_dispute_closed");
  });
});
