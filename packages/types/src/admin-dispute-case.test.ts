import { describe, expect, it } from "vitest";
import {
  type DisputeDomainEventInput,
  countOpenDisputeCases,
  filterDisputeCasesByChip,
  foldDisputeCasesFromEvents,
  summarizeDisputeCases,
} from "./admin-dispute-case.js";

function ev(
  partial: Partial<DisputeDomainEventInput> & Pick<DisputeDomainEventInput, "eventType">,
): DisputeDomainEventInput {
  return {
    aggregateId: "pay-1",
    payload: {
      stripeDisputeId: "dp_1",
      amountCents: 5000,
      currency: "gbp",
      sellerLegalEntityId: "le-1",
      reason: "fraudulent",
    },
    occurredAt: new Date("2026-01-01T10:00:00Z"),
    ...partial,
  };
}

describe("foldDisputeCasesFromEvents", () => {
  it("derives open status from opened event only", () => {
    const rows = foldDisputeCasesFromEvents([ev({ eventType: "payment.dispute_opened" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("open");
    expect(rows[0]?.closedAt).toBeNull();
  });

  it("derives under_review after funds withdrawn", () => {
    const rows = foldDisputeCasesFromEvents([
      ev({ eventType: "payment.dispute_opened", occurredAt: new Date("2026-01-01T10:00:00Z") }),
      ev({
        eventType: "payment.dispute_funds_withdrawn",
        occurredAt: new Date("2026-01-02T10:00:00Z"),
      }),
    ]);
    expect(rows[0]?.status).toBe("under_review");
  });

  it("derives won/lost from closed event", () => {
    const won = foldDisputeCasesFromEvents([
      ev({ eventType: "payment.dispute_opened" }),
      ev({
        eventType: "payment.dispute_closed",
        payload: { stripeDisputeId: "dp_1", outcome: "won" },
        occurredAt: new Date("2026-01-03T10:00:00Z"),
      }),
    ]);
    expect(won[0]?.status).toBe("won");
    expect(won[0]?.outcome).toBe("won");
    expect(won[0]?.closedAt).toBe("2026-01-03T10:00:00.000Z");

    const lost = foldDisputeCasesFromEvents([
      ev({ eventType: "payment.dispute_opened" }),
      ev({
        eventType: "payment.dispute_closed",
        payload: { stripeDisputeId: "dp_1", outcome: "lost" },
      }),
    ]);
    expect(lost[0]?.status).toBe("lost");

    const neutral = foldDisputeCasesFromEvents([
      ev({ eventType: "payment.dispute_opened" }),
      ev({
        eventType: "payment.dispute_closed",
        payload: { stripeDisputeId: "dp_1", outcome: "closed" },
      }),
    ]);
    expect(neutral[0]?.status).toBe("closed");
    expect(neutral[0]?.outcome).toBe("closed");
  });

  it("folds multiple events for the same stripeDisputeId", () => {
    const rows = foldDisputeCasesFromEvents([
      ev({ eventType: "payment.dispute_opened", payload: { stripeDisputeId: "dp_a" } }),
      ev({ eventType: "payment.dispute_opened", payload: { stripeDisputeId: "dp_b" } }),
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe("filterDisputeCasesByChip", () => {
  const cases = foldDisputeCasesFromEvents([
    ev({ eventType: "payment.dispute_opened", payload: { stripeDisputeId: "dp_open" } }),
    ev({
      eventType: "payment.dispute_opened",
      payload: { stripeDisputeId: "dp_review" },
      occurredAt: new Date("2026-01-01T09:00:00Z"),
    }),
    ev({
      eventType: "payment.dispute_funds_withdrawn",
      payload: { stripeDisputeId: "dp_review" },
      occurredAt: new Date("2026-01-01T11:00:00Z"),
    }),
    ev({
      eventType: "payment.dispute_closed",
      payload: { stripeDisputeId: "dp_won", outcome: "won" },
      occurredAt: new Date("2026-01-01T12:00:00Z"),
    }),
    ev({
      eventType: "payment.dispute_opened",
      payload: { stripeDisputeId: "dp_won" },
      occurredAt: new Date("2026-01-01T08:00:00Z"),
    }),
  ]);

  it("filters open and closed chips", () => {
    expect(filterDisputeCasesByChip(cases, "open").every((r) => r.status === "open")).toBe(true);
    expect(filterDisputeCasesByChip(cases, "under_review")).toHaveLength(1);
    expect(filterDisputeCasesByChip(cases, "closed").every((r) => r.status === "won")).toBe(true);
  });
});

describe("summarizeDisputeCases", () => {
  it("counts status buckets", () => {
    const cases = foldDisputeCasesFromEvents([
      ev({ eventType: "payment.dispute_opened" }),
      ev({
        eventType: "payment.dispute_funds_withdrawn",
        payload: { stripeDisputeId: "dp_2" },
      }),
      ev({
        eventType: "payment.dispute_closed",
        payload: { stripeDisputeId: "dp_3", outcome: "won" },
      }),
      ev({
        eventType: "payment.dispute_opened",
        payload: { stripeDisputeId: "dp_3" },
        occurredAt: new Date("2026-01-01T08:00:00Z"),
      }),
    ]);
    expect(summarizeDisputeCases(cases)).toEqual({
      open: 1,
      underReview: 1,
      won: 1,
      lost: 0,
      closed: 0,
    });
  });
});

describe("countOpenDisputeCases", () => {
  it("counts open and under_review", () => {
    const cases = foldDisputeCasesFromEvents([
      ev({ eventType: "payment.dispute_opened" }),
      ev({
        eventType: "payment.dispute_funds_withdrawn",
        payload: { stripeDisputeId: "dp_2" },
      }),
      ev({
        eventType: "payment.dispute_closed",
        payload: { stripeDisputeId: "dp_3", outcome: "won" },
      }),
      ev({
        eventType: "payment.dispute_opened",
        payload: { stripeDisputeId: "dp_3" },
        occurredAt: new Date("2026-01-01T08:00:00Z"),
      }),
    ]);
    expect(countOpenDisputeCases(cases)).toBe(2);
  });
});
