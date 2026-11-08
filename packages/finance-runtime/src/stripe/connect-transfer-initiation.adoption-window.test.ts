import { describe, expect, it, vi } from "vitest";
import { ConnectTransferInitiationService } from "./connect-transfer-initiation.service.js";

const silentLog = { warn: () => {}, error: () => {}, info: () => {} };

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
      const transfer = {
        id: `tr_${transfers.length + 1}`,
        reversed: false,
        amount_reversed: 0,
        ...params,
      };
      transfers.push(transfer);
      keys.set(opts.idempotencyKey, { at: now(), transfer });
      return transfer;
    },
  );
  const list = vi.fn(
    async (q: { transfer_group?: string; starting_after?: string; limit: number }) => {
      const rows = q.transfer_group
        ? transfers.filter((t) => t.transfer_group === q.transfer_group)
        : transfers;
      const start = q.starting_after ? rows.findIndex((t) => t.id === q.starting_after) + 1 : 0;
      return { data: rows.slice(start, start + q.limit), has_more: start + q.limit < rows.length };
    },
  );
  return { transfers: { create, list }, charges: { retrieve: vi.fn() }, store: transfers };
}

function setup(stripe: ReturnType<typeof fakeStripe>, opts: { casLoses?: boolean } = {}) {
  let status = "scheduled";
  const payout = {
    id: "payout-1",
    legalEntityId: "entity-1",
    netAmount: "480.00",
    currency: "GBP",
    processedAt: null,
    createdAt: new Date(1_000_000),
  };
  const payoutRepository = {
    findById: vi.fn(async () => ({ ...payout, status, stripeTransferId: null })),
    // Saving the result fails the first time, as in the incident.
    updateStatusIfCurrent: vi.fn(async (_id: string, _from: string, patch: { status: string }) => {
      if (opts.casLoses) return null;
      status = patch.status;
      return { ...payout, ...patch };
    }),
    listLines: vi.fn().mockResolvedValue([]),
  };
  const sink = { publish: vi.fn().mockResolvedValue(undefined), withTx: vi.fn() };
  const service = new ConnectTransferInitiationService(
    silentLog as never,
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
    payoutRepository,
    reset: () => {
      status = "scheduled";
    },
    setStatus: (next: string) => {
      status = next;
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

  describe("blocking instead of paying twice", () => {
    const stored = (over: Record<string, unknown> = {}) => ({
      id: "tr_x",
      reversed: false,
      amount_reversed: 0,
      destination: "acct_1",
      amount: 48_000,
      currency: "gbp",
      transfer_group: "payout:payout-1",
      metadata: { payoutId: "payout-1" },
      ...over,
    });

    it.each([
      [
        "two live transfers",
        [stored({ id: "tr_a" }), stored({ id: "tr_b" })],
        "multiple_live_transfers",
      ],
      ["a wrong amount", [stored({ amount: 47_000 })], "amount_mismatch"],
      ["a wrong destination", [stored({ destination: "acct_other" })], "destination_mismatch"],
      ["a wrong currency", [stored({ currency: "usd" })], "currency_mismatch"],
      ["a partial reversal", [stored({ amount_reversed: 500 })], "partially_reversed"],
    ])("blocks the payout and creates nothing for %s", async (_name, existing, reason) => {
      const stripe = fakeStripe(() => 0);
      stripe.store.push(...existing);
      const { service, sink, payoutRepository } = setup(stripe);

      await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
        ok: false,
        reason: "transfer_blocked",
      });

      expect(stripe.transfers.create).not.toHaveBeenCalled();
      expect(payoutRepository.updateStatusIfCurrent).toHaveBeenCalledWith(
        "payout-1",
        "scheduled",
        expect.objectContaining({
          status: "transfer_blocked",
          failureReason: expect.stringContaining(`transfer_blocked: ${reason}`),
        }),
      );
      expect(sink.publish).toHaveBeenCalledTimes(1);
      expect(sink.publish).toHaveBeenCalledWith({
        aggregateType: "payout",
        aggregateId: "payout-1",
        eventType: "payout.transfer_blocked",
        payload: { payoutId: "payout-1", legalEntityId: "entity-1", reason },
        actorUserId: null,
        actingLegalEntityId: "entity-1",
      });
    });

    it("blocks a staff retry of a failed payout the same way", async () => {
      const stripe = fakeStripe(() => 0);
      stripe.store.push(stored({ id: "tr_a" }), stored({ id: "tr_b" }));
      const { service, setStatus, payoutRepository } = setup(stripe);
      setStatus("failed");

      await expect(service.initiateTransfer("payout-1", { retryFailed: true })).resolves.toEqual({
        ok: false,
        reason: "transfer_blocked",
      });
      expect(payoutRepository.updateStatusIfCurrent).toHaveBeenCalledWith(
        "payout-1",
        "failed",
        expect.objectContaining({ status: "transfer_blocked" }),
      );
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it("finds the matching transfer on page 2 and adopts it", async () => {
      const stripe = fakeStripe(() => 0);
      for (let i = 0; i < 100; i += 1) {
        stripe.store.push(stored({ id: `tr_rev_${i}`, reversed: true, amount_reversed: 48_000 }));
      }
      stripe.store.push(stored({ id: "tr_page2" }));
      const { service } = setup(stripe);

      await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
        ok: true,
        stripeTransferId: "tr_page2",
      });
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it("adopts a legacy transfer that carries only the payout in its metadata", async () => {
      const stripe = fakeStripe(() => 0);
      stripe.store.push(stored({ id: "tr_legacy", transfer_group: undefined }));
      const { service } = setup(stripe);

      await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
        ok: true,
        stripeTransferId: "tr_legacy",
      });
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it("raises nothing when the payout moved before it could be blocked", async () => {
      const stripe = fakeStripe(() => 0);
      stripe.store.push(stored({ id: "tr_a" }), stored({ id: "tr_b" }));
      const { service, sink } = setup(stripe, { casLoses: true });

      await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
        ok: false,
        reason: "payout_already_processed",
      });
      expect(sink.publish).not.toHaveBeenCalled();
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it("skips an already blocked payout for the cron and for staff retry", async () => {
      const stripe = fakeStripe(() => 0);
      const { service, setStatus, payoutRepository } = setup(stripe);
      setStatus("transfer_blocked");

      for (const opts of [{ keepScheduledOnTransferFailure: true }, { retryFailed: true }]) {
        await expect(service.initiateTransfer("payout-1", opts)).resolves.toEqual({
          ok: false,
          reason: "payout_already_processed",
        });
      }
      expect(stripe.transfers.list).not.toHaveBeenCalled();
      expect(stripe.transfers.create).not.toHaveBeenCalled();
      expect(payoutRepository.updateStatusIfCurrent).not.toHaveBeenCalled();
    });
  });
});
