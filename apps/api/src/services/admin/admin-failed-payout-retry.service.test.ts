import { describe, expect, it, vi } from "vitest";
import { PayoutNotFoundError, PayoutStatusTransitionError } from "../interfaces/payout.js";
import { AdminFailedPayoutRetryService } from "./admin-failed-payout-retry.service.js";

const failed = {
  id: "payout-1",
  status: "failed",
  legalEntityId: "entity-1",
  netAmount: "480.00",
  currency: "GBP",
  failureReason: "stripe_transfer_failed: account_closed - Account closed",
};

function setup(options: { found?: unknown; transfer?: unknown } = {}) {
  const findById = vi
    .fn()
    .mockResolvedValueOnce("found" in options ? options.found : failed)
    .mockResolvedValue({ ...failed, status: "in_transit" });
  const initiateTransfer = vi
    .fn()
    .mockResolvedValue(options.transfer ?? { ok: true, stripeTransferId: "tr_1" });
  const publish = vi.fn().mockResolvedValue(undefined);
  const service = new AdminFailedPayoutRetryService(
    { findById } as never,
    { initiateTransfer },
    { publish, withTx: vi.fn() },
  );
  return { service, initiateTransfer, publish };
}

describe("AdminFailedPayoutRetryService", () => {
  it("records the request against the actor, then sends the transfer again", async () => {
    const { service, initiateTransfer, publish } = setup();

    const outcome = await service.retry("staff-1", "payout-1");

    expect(outcome).toMatchObject({ ok: true, payout: { status: "in_transit" } });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: "payout-1",
        eventType: "payout.transfer_retry_requested",
        actorUserId: "staff-1",
      }),
    );
    expect(initiateTransfer).toHaveBeenCalledWith("payout-1", { retryFailed: true });
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(
      initiateTransfer.mock.invocationCallOrder[0] as number,
    );
  });

  it("refuses a payout that is not failed, without recording or sending", async () => {
    const { service, initiateTransfer, publish } = setup({
      found: { ...failed, status: "in_transit" },
    });

    await expect(service.retry("staff-1", "payout-1")).rejects.toMatchObject({
      code: "payout_not_failed",
    });
    expect(publish).not.toHaveBeenCalled();
    expect(initiateTransfer).not.toHaveBeenCalled();
  });

  it("reports an unknown payout", async () => {
    const { service } = setup({ found: null });
    await expect(service.retry("staff-1", "nope")).rejects.toBeInstanceOf(PayoutNotFoundError);
  });

  it("returns why the transfer could not start", async () => {
    const { service } = setup({
      transfer: { ok: false, reason: "stripe_error", stripeErrorMessage: "Account closed" },
    });

    await expect(service.retry("staff-1", "payout-1")).resolves.toEqual({
      ok: false,
      reason: "stripe_error",
      stripeErrorMessage: "Account closed",
    });
  });

  it("reports a payout another writer moved first as a state change", async () => {
    const { service } = setup({ transfer: { ok: false, reason: "payout_already_processed" } });

    await expect(service.retry("staff-1", "payout-1")).rejects.toBeInstanceOf(
      PayoutStatusTransitionError,
    );
  });
});
