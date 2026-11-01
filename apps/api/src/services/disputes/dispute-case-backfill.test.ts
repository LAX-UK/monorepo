import { describe, expect, it } from "vitest";
import {
  type BackfillEvent,
  type BackfillPayment,
  planDisputeCaseBackfill,
} from "./dispute-case-backfill.js";

const at = (iso: string) => new Date(iso);

const payments: BackfillPayment[] = [
  { id: "pay-1", sellerLegalEntityId: "seller-1", stripeChargeId: "ch_1" },
  { id: "pay-2", sellerLegalEntityId: "seller-2", stripeChargeId: null },
];

const opened = (disputeId: string, paymentId: string, when: string, extra = {}): BackfillEvent => ({
  eventType: "payment.dispute_opened",
  aggregateId: paymentId,
  occurredAt: at(when),
  payload: {
    stripeDisputeId: disputeId,
    stripeChargeId: "ch_1",
    amountCents: 480_000,
    currency: "gbp",
    reason: "fraudulent",
    ...extra,
  },
});

const plan = (events: BackfillEvent[], existing: string[] = []) =>
  planDisputeCaseBackfill({ events, payments, existingDisputeIds: new Set(existing) });

describe("planDisputeCaseBackfill", () => {
  it("rebuilds an open dispute with its invoice and no clawback yet", () => {
    const { cases } = plan([opened("dp_1", "pay-1", "2026-10-20T10:00:00Z")]);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      stripeDisputeId: "dp_1",
      stripeChargeId: "ch_1",
      amountPence: 480_000,
      currency: "gbp",
      reason: "fraudulent",
      status: "needs_response",
      allocationState: "allocated",
      candidatePaymentIds: ["pay-1"],
      dueBy: null,
      closedAt: null,
      fundsWithdrawnAt: null,
      lines: [
        {
          paymentId: "pay-1",
          sellerLegalEntityId: "seller-1",
          amountPence: 480_000,
          sellerSharePence: 480_000,
          clawback: "none",
        },
      ],
    });
  });

  it("follows the funds: withdrawn is under review with the seller clawed back", () => {
    const { cases } = plan([
      opened("dp_1", "pay-1", "2026-10-20T10:00:00Z"),
      {
        eventType: "payment.dispute_funds_withdrawn",
        aggregateId: "pay-1",
        occurredAt: at("2026-10-21T02:00:00Z"),
        payload: { stripeDisputeId: "dp_1", amountCents: 480_000 },
      },
    ]);
    expect(cases[0]).toMatchObject({
      status: "under_review",
      fundsWithdrawnAt: at("2026-10-21T02:00:00Z"),
      lines: [{ clawback: "withdrawn" }],
    });
  });

  it("marks a won dispute closed with the clawback reversed and funds returned", () => {
    const { cases } = plan([
      opened("dp_1", "pay-1", "2026-10-20T10:00:00Z"),
      {
        eventType: "payment.dispute_funds_withdrawn",
        aggregateId: "pay-1",
        occurredAt: at("2026-10-21T02:00:00Z"),
        payload: { stripeDisputeId: "dp_1" },
      },
      {
        eventType: "payment.dispute_closed",
        aggregateId: "pay-1",
        occurredAt: at("2026-11-10T09:00:00Z"),
        payload: { stripeDisputeId: "dp_1", outcome: "won" },
      },
    ]);
    expect(cases[0]).toMatchObject({
      status: "won",
      closedAt: at("2026-11-10T09:00:00Z"),
      fundsReinstatedAt: at("2026-11-10T09:00:00Z"),
      lines: [{ clawback: "reversed" }],
    });
  });

  it("keeps the clawback on a lost dispute, whatever order the events arrive in", () => {
    const { cases } = plan([
      {
        eventType: "payment.dispute_closed",
        aggregateId: "pay-1",
        occurredAt: at("2026-11-10T09:00:00Z"),
        payload: { stripeDisputeId: "dp_1", outcome: "lost" },
      },
      {
        eventType: "payment.dispute_funds_withdrawn",
        aggregateId: "pay-1",
        occurredAt: at("2026-10-21T02:00:00Z"),
        payload: { stripeDisputeId: "dp_1" },
      },
      opened("dp_1", "pay-1", "2026-10-20T10:00:00Z"),
    ]);
    expect(cases[0]).toMatchObject({
      status: "lost",
      fundsReinstatedAt: null,
      lines: [{ clawback: "withdrawn" }],
    });
  });

  it("makes an unmatched dispute a case waiting for allocation, with its deadline", () => {
    const { cases } = plan([
      {
        eventType: "payment.dispute_unmatched",
        aggregateId: "dp_9",
        occurredAt: at("2026-10-30T09:14:00Z"),
        payload: {
          stripeDisputeId: "dp_9",
          stripeChargeId: "ch_unknown",
          amountCents: 235_000,
          currency: "gbp",
          reason: "product_not_received",
          evidenceDueAt: "2026-11-12T23:59:00.000Z",
        },
      },
    ]);
    expect(cases[0]).toMatchObject({
      stripeDisputeId: "dp_9",
      stripeChargeId: "ch_unknown",
      allocationState: "needs_allocation",
      candidatePaymentIds: [],
      lines: [],
      dueBy: at("2026-11-12T23:59:00.000Z"),
    });
  });

  it("takes the charge from the payment when the event has none", () => {
    const { cases, skipped } = plan([
      opened("dp_1", "pay-1", "2026-10-20T10:00:00Z", { stripeChargeId: undefined }),
    ]);
    expect(skipped).toEqual([]);
    expect(cases[0]?.stripeChargeId).toBe("ch_1");
  });

  it("skips what cannot become a case, and says why", () => {
    const result = plan([
      opened("dp_nocharge", "pay-2", "2026-10-20T10:00:00Z", { stripeChargeId: undefined }),
      opened("dp_noamount", "pay-1", "2026-10-20T10:00:00Z", { amountCents: undefined }),
    ]);
    expect(result.cases).toEqual([]);
    expect(result.skipped).toEqual([
      { stripeDisputeId: "dp_noamount", reason: "no_amount" },
      { stripeDisputeId: "dp_nocharge", reason: "no_charge_id" },
    ]);
  });

  it("is idempotent: a dispute that already has a case is skipped", () => {
    const events = [opened("dp_1", "pay-1", "2026-10-20T10:00:00Z")];
    expect(plan(events, ["dp_1"])).toEqual({
      cases: [],
      skipped: [{ stripeDisputeId: "dp_1", reason: "already_a_case" }],
    });
  });

  it("ignores events that are not about disputes", () => {
    expect(
      plan([
        {
          eventType: "payment.captured",
          aggregateId: "pay-1",
          occurredAt: at("2026-10-20T10:00:00Z"),
          payload: { stripeDisputeId: "dp_1" },
        },
      ]).cases,
    ).toEqual([]);
  });
});
