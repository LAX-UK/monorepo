import type { PaymentGroupRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { OpenGroupCheckouts, type OpenGroupCheckoutsDeps } from "./open-group-checkouts.js";
import type { GroupCheckoutStatus } from "./payment-group-ports.js";

function group(overrides: Partial<PaymentGroupRecord> = {}): PaymentGroupRecord {
  return {
    id: "group-1",
    buyerLegalEntityId: "entity-1",
    createdByUserId: "user-1",
    status: "open",
    currency: "GBP",
    totalAmount: "1000.00",
    checkoutRail: "card",
    stripeCheckoutSessionId: "cs_1",
    stripePaymentIntentId: null,
    stripeChargeId: null,
    amountReceived: "0.00",
    receivedEventAt: null,
    createdAt: new Date("2026-11-05T10:00:00Z"),
    settledAt: null,
    ...overrides,
  };
}

const NOW = new Date("2026-11-05T10:30:00Z");

function setup(groups: PaymentGroupRecord[], statusAfterExpire: GroupCheckoutStatus = "expired") {
  const expireCheckout = vi.fn(async () => undefined);
  const checkoutStatus = vi.fn(async () => statusAfterExpire);
  const release = vi.fn(async () => ({
    processed: true,
    action: "payment_intent_canceled" as const,
  }));
  const deps: OpenGroupCheckoutsDeps = {
    groups: { findLiveByPaymentIds: async () => groups },
    gateway: { expireCheckout, checkoutStatus },
    settlement: { release },
    now: () => NOW,
  };
  return { ends: new OpenGroupCheckouts(deps), expireCheckout, checkoutStatus, release };
}

describe("OpenGroupCheckouts", () => {
  it("is clear when no payment holds the invoices", async () => {
    const { ends, expireCheckout, release } = setup([]);
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("clear");
    expect(expireCheckout).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("expires an abandoned checkout, reads it back, then hands the invoices back", async () => {
    const { ends, expireCheckout, checkoutStatus, release } = setup([group()]);
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("clear");
    expect(expireCheckout).toHaveBeenCalledWith("cs_1");
    expect(checkoutStatus).toHaveBeenCalledWith("cs_1");
    expect(release).toHaveBeenCalledWith({
      eventId: null,
      groupId: "group-1",
      reason: "checkout_abandoned",
    });
    // Ended before it was released, never the other way round.
    expect(expireCheckout.mock.invocationCallOrder[0]).toBeLessThan(
      release.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("leaves a checkout the payer finished: a card submitted or a transfer chosen", async () => {
    const { ends, release } = setup([group()], "complete");
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("in_progress");
    expect(release).not.toHaveBeenCalled();
  });

  it("leaves a checkout the provider still shows as open after expiring it", async () => {
    const { ends, release } = setup([group()], "open");
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("in_progress");
    expect(release).not.toHaveBeenCalled();
  });

  it("never ends money on its way", async () => {
    const { ends, expireCheckout, release } = setup([group({ status: "processing" })]);
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("in_progress");
    expect(expireCheckout).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("holds the invoices when the provider cannot be asked", async () => {
    const { ends, expireCheckout, release } = setup([group()]);
    expireCheckout.mockRejectedValueOnce(new Error("network"));
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("unavailable");
    expect(release).not.toHaveBeenCalled();
  });

  it("leaves a payment that is still being opened: it has no checkout yet", async () => {
    const { ends, expireCheckout, release } = setup([
      group({ stripeCheckoutSessionId: null, createdAt: new Date("2026-11-05T10:29:00Z") }),
    ]);
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("in_progress");
    expect(expireCheckout).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("releases a group whose start failed long ago and never got a checkout", async () => {
    const { ends, expireCheckout, release } = setup([
      group({ stripeCheckoutSessionId: null, createdAt: new Date("2026-11-05T10:20:00Z") }),
    ]);
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("clear");
    expect(expireCheckout).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it("reports in progress when the group was settled while it was being ended", async () => {
    const { ends, release } = setup([group()]);
    release.mockResolvedValueOnce({ processed: true, action: "skipped" as never });
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("in_progress");
  });

  it("leaves another member's recent checkout alone, but ends their old one", async () => {
    const recent = setup([
      group({ createdByUserId: "user-2", createdAt: new Date("2026-11-05T10:29:30Z") }),
    ]);
    await expect(recent.ends.endFor(["pay-1"], "user-1")).resolves.toBe("in_progress");
    expect(recent.expireCheckout).not.toHaveBeenCalled();
    const old = setup([group({ createdByUserId: "user-2" })]);
    await expect(old.ends.endFor(["pay-1"], "user-1")).resolves.toBe("clear");
  });

  it("ends the same member's recent checkout: they are starting again", async () => {
    const { ends, release } = setup([group({ createdAt: new Date("2026-11-05T10:29:30Z") })]);
    await expect(ends.endFor(["pay-1"], "user-1")).resolves.toBe("clear");
    expect(release).toHaveBeenCalledOnce();
  });

  it("stops at the first group that is in progress", async () => {
    const { ends, release } = setup([
      group({ id: "g1", status: "processing" }),
      group({ id: "g2" }),
    ]);
    await expect(ends.endFor(["pay-1", "pay-2"], "user-1")).resolves.toBe("in_progress");
    expect(release).not.toHaveBeenCalled();
  });
});
