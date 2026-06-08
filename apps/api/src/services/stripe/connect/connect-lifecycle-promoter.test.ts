import { describe, expect, it, vi } from "vitest";
import { ConnectLifecyclePromoter } from "./connect-lifecycle-promoter.js";

function makeDbWithLifecycleUpdate(returning: unknown[]) {
  const returningFn = vi.fn().mockResolvedValue(returning);
  const where = vi.fn().mockReturnValue({ returning: returningFn });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { db: { update } as never, set, where, returningFn };
}

describe("ConnectLifecyclePromoter", () => {
  it("promotes connect_pending to approved when Stripe account is configured", async () => {
    const publish = vi.fn();
    const promoter = new ConnectLifecyclePromoter({ publish } as never);
    const { db, set } = makeDbWithLifecycleUpdate([{ id: "e1", status: "approved" }]);

    await promoter.applyStripeAccountFlags(
      {
        id: "acct_1",
        charges_enabled: false,
        payouts_enabled: true,
        requirements: { currently_due: [], disabled_reason: null },
      } as never,
      {
        id: "e1",
        kind: "individual",
        status: "connect_pending",
        stripeConnectAccountId: "acct_1",
        isLaxManaged: false,
      } as never,
      db,
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        stripeConnectPayoutsEnabled: true,
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        eventType: "legal_entity.lifecycle_progressed",
        payload: expect.objectContaining({ reason: "stripe_connect_ready" }),
      }),
    );
  });

  it("demotes approved to connect_pending when requirements become due", async () => {
    const publish = vi.fn();
    const promoter = new ConnectLifecyclePromoter({ publish } as never);
    const { db, set } = makeDbWithLifecycleUpdate([{ id: "e1", status: "connect_pending" }]);

    await promoter.applyStripeAccountFlags(
      {
        id: "acct_1",
        charges_enabled: false,
        payouts_enabled: true,
        requirements: { currently_due: ["external_account"], disabled_reason: null },
      } as never,
      {
        id: "e1",
        kind: "individual",
        status: "approved",
        stripeConnectAccountId: "acct_1",
        isLaxManaged: false,
      } as never,
      db,
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "connect_pending",
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        eventType: "legal_entity.lifecycle_progressed",
        payload: expect.objectContaining({ reason: "stripe_connect_requirements_due" }),
      }),
    );
  });

  it("does not promote or demote LAX-managed entities", async () => {
    const publish = vi.fn();
    const promoter = new ConnectLifecyclePromoter({ publish } as never);
    const { db, set } = makeDbWithLifecycleUpdate([]);

    await promoter.applyStripeAccountFlags(
      {
        id: "acct_1",
        charges_enabled: false,
        payouts_enabled: false,
        requirements: { currently_due: ["external_account"], disabled_reason: null },
      } as never,
      {
        id: "e1",
        kind: "organisation",
        status: "connect_pending",
        stripeConnectAccountId: "acct_1",
        isLaxManaged: true,
      } as never,
      db,
    );

    expect(set).toHaveBeenCalledWith(
      expect.not.objectContaining({
        status: expect.anything(),
      }),
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("no-ops lifecycle when status already matches configured state", async () => {
    const publish = vi.fn();
    const promoter = new ConnectLifecyclePromoter({ publish } as never);
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const db = { update: vi.fn().mockReturnValue({ set }) } as never;

    await promoter.applyStripeAccountFlags(
      {
        id: "acct_1",
        charges_enabled: false,
        payouts_enabled: true,
        requirements: { currently_due: [], disabled_reason: null },
      } as never,
      {
        id: "e1",
        kind: "individual",
        status: "approved",
        stripeConnectAccountId: "acct_1",
        isLaxManaged: false,
      } as never,
      db,
    );

    expect(set).toHaveBeenCalledWith(expect.not.objectContaining({ status: expect.anything() }));
    expect(publish).not.toHaveBeenCalled();
  });

  it("skips lifecycle event when concurrent webhook wins the status transition", async () => {
    const publish = vi.fn();
    const promoter = new ConnectLifecyclePromoter({ publish } as never);
    const { db } = makeDbWithLifecycleUpdate([]);

    await promoter.applyStripeAccountFlags(
      {
        id: "acct_1",
        charges_enabled: false,
        payouts_enabled: true,
        requirements: { currently_due: [], disabled_reason: null },
      } as never,
      {
        id: "e1",
        kind: "individual",
        status: "connect_pending",
        stripeConnectAccountId: "acct_1",
        isLaxManaged: false,
      } as never,
      db,
    );

    expect(publish).not.toHaveBeenCalled();
  });
});
