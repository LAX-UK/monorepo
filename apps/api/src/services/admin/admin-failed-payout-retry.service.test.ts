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
  processedAt: new Date("2026-11-08T10:00:00Z"),
};
const AFTER_COOL_OFF = new Date("2026-11-08T10:05:00Z");

function setup(options: { found?: unknown; transfer?: unknown; now?: Date } = {}) {
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
    () => options.now ?? AFTER_COOL_OFF,
  );
  return { service, initiateTransfer, publish };
}

const REASON = "Seller fixed their bank details";

describe("AdminFailedPayoutRetryService", () => {
  it("skips a blocked payout: staff retry never sends a transfer for it", async () => {
    const { service, initiateTransfer, publish } = setup({
      found: { ...failed, status: "transfer_blocked" },
    });

    await expect(service.retry("staff-1", "payout-1")).rejects.toThrow(PayoutStatusTransitionError);

    expect(initiateTransfer).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("records the request against the actor, then sends the transfer again", async () => {
    const { service, initiateTransfer, publish } = setup();

    const outcome = await service.retry("staff-1", "payout-1", REASON);

    expect(outcome).toMatchObject({ ok: true, payout: { status: "in_transit" } });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: "payout-1",
        eventType: "payout.transfer_retry_requested",
        actorUserId: "staff-1",
        payload: expect.objectContaining({ reason: REASON }),
      }),
    );
    expect(initiateTransfer).toHaveBeenCalledWith("payout-1", { retryFailed: true });
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(
      initiateTransfer.mock.invocationCallOrder[0] as number,
    );
  });

  describe("cool-off after a failure", () => {
    const tooSoon = {
      ok: false,
      reason: "retry_too_soon",
      message: "Wait a few minutes: Stripe may still be finishing the last attempt",
    };

    it("refuses a retry one second inside five minutes, recording and sending nothing", async () => {
      const { service, initiateTransfer, publish } = setup({
        now: new Date("2026-11-08T10:04:59Z"),
      });

      await expect(service.retry("staff-1", "payout-1")).resolves.toEqual(tooSoon);
      expect(publish).not.toHaveBeenCalled();
      expect(initiateTransfer).not.toHaveBeenCalled();
    });

    it("refuses a retry made the moment the payout failed", async () => {
      const { service, initiateTransfer } = setup({ now: failed.processedAt });
      await expect(service.retry("staff-1", "payout-1")).resolves.toEqual(tooSoon);
      expect(initiateTransfer).not.toHaveBeenCalled();
    });

    it("allows a retry at exactly five minutes", async () => {
      const { service, initiateTransfer } = setup({ now: AFTER_COOL_OFF });
      await expect(service.retry("staff-1", "payout-1")).resolves.toMatchObject({ ok: true });
      expect(initiateTransfer).toHaveBeenCalledTimes(1);
    });

    it("does not delay a failed payout that has no processing time", async () => {
      const { service, initiateTransfer } = setup({ found: { ...failed, processedAt: null } });
      await expect(service.retry("staff-1", "payout-1")).resolves.toMatchObject({ ok: true });
      expect(initiateTransfer).toHaveBeenCalledTimes(1);
    });
  });

  it("refuses a payout that is not failed, without recording or sending", async () => {
    const { service, initiateTransfer, publish } = setup({
      found: { ...failed, status: "in_transit" },
    });

    await expect(service.retry("staff-1", "payout-1", REASON)).rejects.toMatchObject({
      code: "payout_not_failed",
    });
    expect(publish).not.toHaveBeenCalled();
    expect(initiateTransfer).not.toHaveBeenCalled();
  });

  it("reports an unknown payout", async () => {
    const { service } = setup({ found: null });
    await expect(service.retry("staff-1", "nope", REASON)).rejects.toBeInstanceOf(
      PayoutNotFoundError,
    );
  });

  it("returns why the transfer could not start", async () => {
    const { service } = setup({
      transfer: { ok: false, reason: "stripe_error", stripeErrorMessage: "Account closed" },
    });

    await expect(service.retry("staff-1", "payout-1", REASON)).resolves.toEqual({
      ok: false,
      reason: "stripe_error",
      stripeErrorMessage: "Account closed",
    });
  });

  it("reports a payout another writer moved first as a state change", async () => {
    const { service } = setup({ transfer: { ok: false, reason: "payout_already_processed" } });

    await expect(service.retry("staff-1", "payout-1", REASON)).rejects.toBeInstanceOf(
      PayoutStatusTransitionError,
    );
  });
});
