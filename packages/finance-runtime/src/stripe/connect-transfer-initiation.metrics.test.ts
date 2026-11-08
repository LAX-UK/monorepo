import { describe, expect, it, vi } from "vitest";
import { ConnectTransferInitiationService } from "./connect-transfer-initiation.service.js";

const silentLog = { warn: () => {}, error: () => {}, info: () => {} };

function negativePayoutService(metrics?: { record: (event: string) => void }) {
  const payout = {
    id: "payout-1",
    status: "scheduled",
    legalEntityId: "entity-1",
    netAmount: "-5.00",
    currency: "GBP",
    processedAt: null,
  };
  const publish = vi.fn().mockResolvedValue(undefined);
  const service = new ConnectTransferInitiationService(
    silentLog as never,
    { findLegalEntityById: vi.fn(), findStripeChargeIdByPaymentId: vi.fn() } as never,
    { get: () => ({}) } as never,
    { syncAccountFromStripe: vi.fn() } as never,
    {
      findById: vi.fn().mockResolvedValue(payout),
      updateStatusIfCurrent: vi.fn().mockResolvedValue({ ...payout, status: "clawback_pending" }),
    } as never,
    { publish },
    metrics,
  );
  return { service, publish };
}

describe("ConnectTransferInitiationService money-path metrics", () => {
  it("counts a clawback and publishes the event", async () => {
    const record = vi.fn();
    const { service, publish } = negativePayoutService({ record });
    await expect(service.initiateTransfer("payout-1")).resolves.toEqual({
      ok: false,
      reason: "negative_net_amount",
    });
    expect(record).toHaveBeenCalledWith("payout_clawback_required");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payout.clawback_required" }),
    );
  });

  it("drops the count when no metrics port is given", async () => {
    const { service } = negativePayoutService();
    await expect(service.initiateTransfer("payout-1")).resolves.toMatchObject({ ok: false });
  });
});
