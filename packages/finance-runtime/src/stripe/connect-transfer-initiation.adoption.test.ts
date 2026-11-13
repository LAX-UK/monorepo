import { describe, expect, it, vi } from "vitest";
import { ConnectTransferInitiationService } from "./connect-transfer-initiation.service.js";
import { inlinePayoutTransactions } from "./connect-transfer-initiation.test-util.js";

type FakeTransfer = Record<string, unknown> & { id: string };

const live = (over: Partial<FakeTransfer> = {}): FakeTransfer => ({
  id: "tr_ok",
  destination: "acct_1",
  amount: 1000,
  amount_reversed: 0,
  reversed: false,
  currency: "gbp",
  metadata: { payoutId: "p1" },
  ...over,
});

/** A fake Stripe with paged `transfers.list`; `group` rows match the payout's transfer_group. */
function setup(
  existing: FakeTransfer[],
  opts: { status?: string; casLoses?: boolean; legacy?: FakeTransfer[] } = {},
) {
  const stripe = {
    transfers: {
      list: vi.fn(
        async (p: { transfer_group?: string; starting_after?: string; limit: number }) => {
          const rows = p.transfer_group ? existing : (opts.legacy ?? []);
          const start = p.starting_after ? rows.findIndex((t) => t.id === p.starting_after) + 1 : 0;
          return {
            data: rows.slice(start, start + p.limit),
            has_more: start + p.limit < rows.length,
          };
        },
      ),
      create: vi.fn().mockResolvedValue({ id: "tr_new" }),
    },
    charges: { retrieve: vi.fn() },
  };
  const payout = {
    id: "p1",
    status: opts.status ?? "scheduled",
    legalEntityId: "e1",
    netAmount: "10.00",
    currency: "GBP",
    stripeTransferId: null,
    createdAt: new Date(1_000_000),
  };
  const publish = vi.fn().mockResolvedValue(undefined);
  const updateStatusIfCurrent = vi.fn(async (_id: string, _from: string, patch: object) =>
    opts.casLoses ? null : { ...payout, ...patch },
  );
  const log = { warn: vi.fn(), error: vi.fn() };
  const service = new ConnectTransferInitiationService(
    log as never,
    {
      findLegalEntityById: vi.fn().mockResolvedValue({ stripeConnectAccountId: "acct_1" }),
      findStripeChargeIdByPaymentId: vi.fn(),
    } as never,
    { get: () => stripe } as never,
    { syncAccountFromStripe: vi.fn().mockResolvedValue({ ready: true }) } as never,
    {
      findById: vi.fn().mockResolvedValue(payout),
      updateStatusIfCurrent,
      listLines: vi.fn().mockResolvedValue([]),
    } as never,
    { publish } as never,
    undefined,
    inlinePayoutTransactions(),
  );
  return { service, stripe, publish, updateStatusIfCurrent, log };
}

describe("ConnectTransferInitiationService (finance-runtime) transfer decision", () => {
  it("adopts an exact match instead of creating another", async () => {
    const { service, stripe, publish } = setup([live({ id: "tr_old" })]);
    await expect(service.initiateTransfer("p1")).resolves.toEqual({
      ok: true,
      stripeTransferId: "tr_old",
    });
    expect(stripe.transfers.list).toHaveBeenCalledWith(
      expect.objectContaining({ transfer_group: "payout:p1" }),
    );
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ adopted: true, stripeTransferId: "tr_old" }),
      }),
    );
  });

  it("creates a grouped transfer with the same key when none exists", async () => {
    const { service, stripe } = setup([]);
    await service.initiateTransfer("p1");
    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        transfer_group: "payout:p1",
        amount: 1000,
        metadata: expect.objectContaining({ payoutId: "p1" }),
      }),
      { idempotencyKey: "payout:transfer:p1" },
    );
  });

  it.each([
    ["two live transfers", [live({ id: "a" }), live({ id: "b" })], "multiple_live_transfers"],
    ["a wrong amount", [live({ amount: 999 })], "amount_mismatch"],
    ["a wrong destination", [live({ destination: "acct_9" })], "destination_mismatch"],
    ["a wrong currency", [live({ currency: "usd" })], "currency_mismatch"],
    ["a partial reversal", [live({ amount_reversed: 1 })], "partially_reversed"],
  ])("blocks the payout and creates nothing for %s", async (_n, existing, reason) => {
    const { service, stripe, publish, updateStatusIfCurrent, log } = setup(existing);
    await expect(service.initiateTransfer("p1")).resolves.toEqual({
      ok: false,
      reason: "transfer_blocked",
    });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(updateStatusIfCurrent).toHaveBeenCalledTimes(1);
    expect(updateStatusIfCurrent).toHaveBeenCalledWith(
      "p1",
      "scheduled",
      expect.objectContaining({
        status: "transfer_blocked",
        stripeTransferId: null,
        failureReason: expect.stringContaining(`transfer_blocked: ${reason}`),
      }),
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      aggregateType: "payout",
      aggregateId: "p1",
      eventType: "payout.transfer_blocked",
      payload: { payoutId: "p1", legalEntityId: "e1", reason },
      actorUserId: null,
      actingLegalEntityId: "e1",
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ payoutId: "p1", reason }),
      "payout_transfer_blocked",
    );
  });

  it("finds a match on page 2 and creates nothing", async () => {
    const filler = Array.from({ length: 100 }, (_, i) =>
      live({ id: `tr_rev_${i}`, reversed: true, amount_reversed: 1000 }),
    );
    const { service, stripe } = setup([...filler, live({ id: "tr_page2" })]);
    await expect(service.initiateTransfer("p1")).resolves.toEqual({
      ok: true,
      stripeTransferId: "tr_page2",
    });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("adopts a legacy transfer found only by metadata", async () => {
    const { service, stripe } = setup([], { legacy: [live({ id: "tr_legacy" })] });
    await expect(service.initiateTransfer("p1")).resolves.toEqual({
      ok: true,
      stripeTransferId: "tr_legacy",
    });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("raises nothing when another process moved the payout first", async () => {
    const { service, stripe, publish, log } = setup([live({ amount: 1 })], { casLoses: true });
    await expect(service.initiateTransfer("p1")).resolves.toEqual({
      ok: false,
      reason: "payout_already_processed",
    });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("does not touch Stripe for a payout that is already blocked", async () => {
    const { service, stripe, updateStatusIfCurrent } = setup([], { status: "transfer_blocked" });
    await expect(service.initiateTransfer("p1")).resolves.toEqual({
      ok: false,
      reason: "payout_already_processed",
    });
    expect(stripe.transfers.list).not.toHaveBeenCalled();
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(updateStatusIfCurrent).not.toHaveBeenCalled();
  });
});
