import type { IEmailService } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import {
  fanoutDisputeUnmatched,
  formatRespondBy,
  stripeDisputeDashboardUrl,
} from "./notification-fanout.js";

/** Chainable Drizzle-like fake whose awaited queries resolve, in call order, from `results`. */
function fakeDb(results: unknown[]) {
  const make = () => {
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === "then") {
          const value = results.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return () => proxy;
      },
    });
    return proxy;
  };
  return new Proxy(
    {},
    {
      get() {
        return () => make();
      },
    },
  ) as never;
}

function makeEmail(): IEmailService {
  return { enqueue: vi.fn().mockResolvedValue(undefined) } as unknown as IEmailService;
}

const payload = {
  stripeEventType: "charge.dispute.created",
  stripeDisputeId: "dp_orphan",
  stripeChargeId: "ch_orphan",
  amountCents: 12345,
  currency: "gbp",
  reason: "fraudulent",
  status: "needs_response",
  evidenceDueAt: "2026-11-04T00:00:00.000Z",
  livemode: true,
};

const expectedVars = {
  disputeId: "dp_orphan",
  chargeId: "ch_orphan",
  amount: "123.45",
  currency: "GBP",
  reason: "fraudulent",
  status: "needs_response",
  respondBy: "4 Nov 2026, 00:00 UTC",
  stripeEventType: "charge.dispute.created",
  stripeDashboardUrl: "https://dashboard.stripe.com/disputes/dp_orphan",
};

describe("fanoutDisputeUnmatched", () => {
  it("alerts every staff ops recipient and the ops inbox, idempotent per domain event", async () => {
    const emailService = makeEmail();
    const db = fakeDb([[{ id: "staff_1", email: "finance@lax.bid", firstName: "Fin" }]]);

    await fanoutDisputeUnmatched({
      db,
      emailService,
      adminEmailAddress: "admin@lax.bid",
      eventId: 99,
      payload,
    });

    expect(emailService.enqueue).toHaveBeenCalledTimes(2);
    expect(emailService.enqueue).toHaveBeenCalledWith({
      template: "dispute-unmatched-admin-notice",
      to: "finance@lax.bid",
      userId: "staff_1",
      vars: expectedVars,
      category: "transactional",
      idempotencyKey: "dispute-unmatched-admin-notice:99:ops:staff_1",
    });
    expect(emailService.enqueue).toHaveBeenCalledWith({
      template: "dispute-unmatched-admin-notice",
      to: "admin@lax.bid",
      recipientResolution: "snapshot",
      vars: expectedVars,
      category: "transactional",
      idempotencyKey: "dispute-unmatched-admin-notice:99:admin",
    });
  });

  it("does not email the ops inbox twice when it is also a staff account", async () => {
    const emailService = makeEmail();
    const db = fakeDb([[{ id: "staff_1", email: "Admin@lax.bid", firstName: null }]]);

    await fanoutDisputeUnmatched({
      db,
      emailService,
      adminEmailAddress: "admin@lax.bid",
      eventId: 100,
      payload,
    });

    expect(emailService.enqueue).toHaveBeenCalledTimes(1);
  });

  it("still alerts the ops inbox when no staff accounts exist", async () => {
    const emailService = makeEmail();
    const db = fakeDb([[]]);

    await fanoutDisputeUnmatched({
      db,
      emailService,
      adminEmailAddress: "admin@lax.bid",
      eventId: 101,
      payload: { ...payload, evidenceDueAt: null, reason: null },
    });

    expect(emailService.enqueue).toHaveBeenCalledTimes(1);
    expect(emailService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@lax.bid",
        vars: expect.objectContaining({ respondBy: null, reason: null }),
      }),
    );
  });
});

describe("stripeDisputeDashboardUrl", () => {
  it("links live and test mode disputes", () => {
    expect(stripeDisputeDashboardUrl("dp_1", true)).toBe(
      "https://dashboard.stripe.com/disputes/dp_1",
    );
    expect(stripeDisputeDashboardUrl("dp_1", false)).toBe(
      "https://dashboard.stripe.com/test/disputes/dp_1",
    );
  });
});

describe("formatRespondBy", () => {
  it("returns null for a missing or invalid date", () => {
    expect(formatRespondBy(null)).toBeNull();
    expect(formatRespondBy("not-a-date")).toBeNull();
  });
});
