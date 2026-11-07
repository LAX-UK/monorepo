import { describe, expect, it, vi } from "vitest";
import { ConnectTransferInitiationService } from "./connect-transfer-initiation.service.js";

const HOUR = 3_600_000;

/** In-memory Stripe: keys are replayed for 24h, after which the same key creates a new transfer. */
function fakeStripe(now: () => number) {
  const transfers: Array<Record<string, unknown>> = [];
  const keys = new Map<string, { at: number; transfer: Record<string, unknown> }>();
  const create = vi.fn(
    async (params: Record<string, unknown>, opts: { idempotencyKey: string }) => {
      // Like Stripe, a second request with a live key gets the first request's result.
      const seen = keys.get(opts.idempotencyKey);
      if (seen && now() - seen.at < 24 * HOUR) return seen.transfer;
      const transfer = { id: `tr_${transfers.length + 1}`, reversed: false, ...params };
      transfers.push(transfer);
      keys.set(opts.idempotencyKey, { at: now(), transfer });
      return transfer;
    },
  );
  const list = vi.fn(async (q: { transfer_group: string }) => ({
    data: transfers.filter((t) => t.transfer_group === q.transfer_group),
  }));
  return { transfers: { create, list }, charges: { retrieve: vi.fn() }, store: transfers };
}

function setup(stripe: ReturnType<typeof fakeStripe>) {
  let status = "scheduled";
  const payout = {
    id: "payout-1",
    legalEntityId: "entity-1",
    netAmount: "480.00",
    currency: "GBP",
    processedAt: null,
  };
  const payoutRepository = {
    findById: vi.fn(async () => ({ ...payout, status, stripeTransferId: null })),
    // Saving the result fails the first time, as in the incident.
    updateStatusIfCurrent: vi.fn(async (_id: string, _from: string, patch: { status: string }) => {
      status = patch.status;
      return { ...payout, ...patch };
    }),
    listLines: vi.fn().mockResolvedValue([]),
  };
  const sink = { publish: vi.fn().mockResolvedValue(undefined), withTx: vi.fn() };
  const service = new ConnectTransferInitiationService(
    { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    {
      findLegalEntityById: vi.fn().mockResolvedValue({ stripeConnectAccountId: "acct_1" }),
      findStripeChargeIdByPaymentId: vi.fn(),
    } as never,
    { get: () => stripe } as never,
    { syncAccountFromStripe: vi.fn().mockResolvedValue({ ready: true }) } as never,
    payoutRepository as never,
    sink as never,
  );
  return {
    service,
    sink,
    reset: () => {
      status = "scheduled";
    },
  };
}

describe("payout transfer adoption across the Stripe idempotency window", () => {
  it("creates a new transfer when none exists, tagged with the transfer group", async () => {
    const stripe = fakeStripe(() => 0);
    const { service } = setup(stripe);
    await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
      ok: true,
      stripeTransferId: "tr_1",
    });
    expect(stripe.store).toHaveLength(1);
    expect(stripe.store[0]).toMatchObject({
      transfer_group: "payout:payout-1",
      metadata: { payoutId: "payout-1" },
    });
  });

  it("retry within 24h adopts the transfer and creates no second one", async () => {
    let now = 0;
    const stripe = fakeStripe(() => now);
    const { service, reset } = setup(stripe);
    await service.initiateTransfer("payout-1");
    reset();
    now = 2 * HOUR;
    await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
      ok: true,
      stripeTransferId: "tr_1",
    });
    expect(stripe.store).toHaveLength(1);
  });

  it("retry after 24h finds the existing transfer and does not create a new one", async () => {
    let now = 0;
    const stripe = fakeStripe(() => now);
    const { service, sink, reset } = setup(stripe);
    await service.initiateTransfer("payout-1");
    reset();
    now = 30 * HOUR;
    stripe.transfers.create.mockClear();
    await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
      ok: true,
      stripeTransferId: "tr_1",
    });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(stripe.store).toHaveLength(1);
    expect(sink.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "payout.transfer_initiated",
        payload: expect.objectContaining({
          adopted: true,
          adoptionSource: "stripe_transfer_group",
          stripeTransferId: "tr_1",
        }),
      }),
    );
  });

  it("ignores a fully reversed transfer and creates a fresh one", async () => {
    const stripe = fakeStripe(() => 0);
    stripe.store.push({
      id: "tr_old",
      reversed: true,
      destination: "acct_1",
      transfer_group: "payout:payout-1",
      metadata: { payoutId: "payout-1" },
    });
    const { service } = setup(stripe);
    const result = await service.initiateTransfer("payout-1");
    expect(result).toEqual({ ok: true, stripeTransferId: "tr_2" });
  });

  it("two concurrent attempts create exactly one transfer", async () => {
    const stripe = fakeStripe(() => 0);
    const a = setup(stripe);
    const b = setup(stripe);
    await Promise.all([
      a.service.initiateTransfer("payout-1"),
      b.service.initiateTransfer("payout-1"),
    ]);
    expect(stripe.store).toHaveLength(1);
  });
});
