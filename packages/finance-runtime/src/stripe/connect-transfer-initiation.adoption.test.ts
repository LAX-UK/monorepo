import { describe, expect, it, vi } from "vitest";
import { ConnectTransferInitiationService } from "./connect-transfer-initiation.service.js";

function setup(existing: unknown[]) {
  const stripe = {
    transfers: {
      list: vi.fn().mockResolvedValue({ data: existing }),
      create: vi.fn().mockResolvedValue({ id: "tr_new" }),
    },
    charges: { retrieve: vi.fn() },
  };
  const payout = {
    id: "p1",
    status: "scheduled",
    legalEntityId: "e1",
    netAmount: "10.00",
    currency: "GBP",
    stripeTransferId: null,
  };
  const publish = vi.fn().mockResolvedValue(undefined);
  const service = new ConnectTransferInitiationService(
    { warn: vi.fn(), error: vi.fn() } as never,
    {
      findLegalEntityById: vi.fn().mockResolvedValue({ stripeConnectAccountId: "acct_1" }),
      findStripeChargeIdByPaymentId: vi.fn(),
    } as never,
    { get: () => stripe } as never,
    { syncAccountFromStripe: vi.fn().mockResolvedValue({ ready: true }) } as never,
    {
      findById: vi.fn().mockResolvedValue(payout),
      updateStatusIfCurrent: vi.fn().mockResolvedValue({ ...payout, status: "in_transit" }),
      listLines: vi.fn().mockResolvedValue([]),
    } as never,
    { publish } as never,
  );
  return { service, stripe, publish };
}

describe("ConnectTransferInitiationService adoption", () => {
  it("adopts an existing transfer for the payout group instead of creating another", async () => {
    const { service, stripe, publish } = setup([
      { id: "tr_old", destination: "acct_1", reversed: false, metadata: { payoutId: "p1" } },
    ]);
    await expect(service.initiateTransfer("p1")).resolves.toEqual({
      ok: true,
      stripeTransferId: "tr_old",
    });
    expect(stripe.transfers.list).toHaveBeenCalledWith({ transfer_group: "payout:p1", limit: 20 });
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
        metadata: expect.objectContaining({ payoutId: "p1" }),
      }),
      { idempotencyKey: "payout:transfer:p1" },
    );
  });
});
