import { beforeEach, describe, expect, it, vi } from "vitest";

const createConnectTransfer = vi.fn();
vi.mock("@auction/stripe-connect", () => ({ createConnectTransfer }));

const { ConnectTransferInitiationService } = await import(
  "./connect-transfer-initiation.service.js"
);

const FAILED_AT = new Date("2026-10-30T10:00:00.000Z");

function setup(status: string) {
  const payout = {
    id: "payout-1",
    status,
    legalEntityId: "entity-1",
    netAmount: "480.00",
    currency: "GBP",
    processedAt: FAILED_AT,
  };
  const payoutRepository = {
    findById: vi.fn().mockResolvedValue(payout),
    updateStatusIfCurrent: vi.fn().mockResolvedValue({ ...payout, status: "in_transit" }),
    listLines: vi.fn().mockResolvedValue([]),
  };
  const service = new ConnectTransferInitiationService(
    { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    {
      findLegalEntityById: vi.fn().mockResolvedValue({ stripeConnectAccountId: "acct_1" }),
      findStripeChargeIdByPaymentId: vi.fn(),
    } as never,
    { get: () => ({}) } as never,
    { syncAccountFromStripe: vi.fn().mockResolvedValue({ ready: true }) } as never,
    payoutRepository as never,
  );
  return { service, payoutRepository };
}

describe("ConnectTransferInitiationService retry of a failed payout", () => {
  beforeEach(() => {
    createConnectTransfer.mockReset().mockResolvedValue({ id: "tr_new" });
  });

  it("starts from a failed payout and moves it only while it is still failed", async () => {
    const { service, payoutRepository } = setup("failed");

    const result = await service.initiateTransfer("payout-1", { retryFailed: true });

    expect(result).toEqual({ ok: true, stripeTransferId: "tr_new" });
    expect(payoutRepository.updateStatusIfCurrent).toHaveBeenCalledWith(
      "payout-1",
      "failed",
      expect.objectContaining({ status: "in_transit", stripeTransferId: "tr_new" }),
    );
  });

  it("uses a Stripe key tied to the failure being retried", async () => {
    const { service } = setup("failed");

    await service.initiateTransfer("payout-1", { retryFailed: true });

    expect(createConnectTransfer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: `payout:transfer:payout-1:retry:${FAILED_AT.getTime()}`,
      }),
    );
  });

  it("keeps the original key for the scheduled path", async () => {
    const { service } = setup("scheduled");

    await service.initiateTransfer("payout-1");

    expect(createConnectTransfer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: "payout:transfer:payout-1" }),
    );
  });

  it("does not retry a payout that is not failed", async () => {
    const { service } = setup("scheduled");

    await expect(service.initiateTransfer("payout-1", { retryFailed: true })).resolves.toEqual({
      ok: false,
      reason: "payout_already_processed",
    });
    expect(createConnectTransfer).not.toHaveBeenCalled();
  });

  it("does not send a scheduled run for a failed payout", async () => {
    const { service } = setup("failed");

    await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
      ok: false,
      reason: "payout_already_processed",
    });
  });
});
