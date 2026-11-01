import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { STRIPE_DISPUTE_FIXTURE } from "../../test/stripe-dispute-fixture.js";
import {
  disputeChargeId,
  disputeCreatedAt,
  disputePaymentIntentId,
  disputeSnapshotFromStripe,
} from "./stripe-dispute-snapshot.js";

const event = (created?: number) =>
  ({ id: "evt_1", type: "charge.dispute.created", created }) as unknown as Stripe.Event;
const NOW = new Date("2026-11-01T12:00:00Z");

describe("disputeSnapshotFromStripe", () => {
  it("reads the deadline, reason codes, card and evidence from Stripe's dispute", () => {
    expect(disputeSnapshotFromStripe(event(1_798_000_100), STRIPE_DISPUTE_FIXTURE, NOW)).toEqual({
      status: "needs_response",
      amountPence: 500_000,
      currency: "gbp",
      reason: "fraudulent",
      networkReasonCode: "10.4",
      cardBrand: "visa",
      cardLast4: null,
      dueBy: new Date(1_798_950_000 * 1000),
      evidenceSubmitted: false,
      chargeRefundable: true,
      eventAt: new Date(1_798_000_100 * 1000),
      closedAt: null,
    });
  });

  it("takes the card's last four digits from an expanded charge", () => {
    const dispute = {
      ...STRIPE_DISPUTE_FIXTURE,
      charge: { id: "ch_fixture", payment_method_details: { card: { last4: "4242" } } },
    } as unknown as Stripe.Dispute;
    expect(disputeSnapshotFromStripe(event(), dispute, NOW).cardLast4).toBe("4242");
    expect(disputeChargeId(dispute)).toBe("ch_fixture");
  });

  it("marks submitted evidence and a closed dispute", () => {
    const dispute = {
      ...STRIPE_DISPUTE_FIXTURE,
      status: "lost",
      evidence_details: { due_by: null, submission_count: 1 },
    } as unknown as Stripe.Dispute;
    const snapshot = disputeSnapshotFromStripe(event(1_798_100_000), dispute, NOW);
    expect(snapshot.evidenceSubmitted).toBe(true);
    expect(snapshot.dueBy).toBeNull();
    expect(snapshot.closedAt).toEqual(new Date(1_798_100_000 * 1000));
  });

  it("copes with the minimal dispute objects older tests and hand-made events carry", () => {
    const minimal = {
      id: "dp_1",
      status: "under_review",
      amount: 500000,
      currency: "gbp",
      charge: "ch_1",
    } as Stripe.Dispute;
    expect(disputeSnapshotFromStripe(event(), minimal, NOW)).toMatchObject({
      reason: null,
      networkReasonCode: null,
      cardBrand: null,
      dueBy: null,
      evidenceSubmitted: false,
      chargeRefundable: null,
      eventAt: NOW,
    });
    expect(disputePaymentIntentId(minimal)).toBeNull();
    expect(disputeCreatedAt(minimal, NOW)).toEqual(NOW);
  });

  it("finds no charge when Stripe sent none", () => {
    expect(disputeChargeId({ charge: null } as unknown as Stripe.Dispute)).toBeNull();
  });
});
