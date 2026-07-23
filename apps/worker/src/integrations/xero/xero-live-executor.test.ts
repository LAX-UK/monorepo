import { describe, expect, it, vi } from "vitest";
import {
  buildLegacyXeroCommandFromEvent,
  buildXeroCommandFromEvent,
  diffXeroShadowCommand,
} from "./xero-command-projector.js";
import { executeXeroLiveCommand } from "./xero-live-executor.js";

describe("buildLegacyXeroCommandFromEvent", () => {
  it("only maps payout.paid", () => {
    expect(
      buildLegacyXeroCommandFromEvent({
        id: 1,
        eventType: "payment.captured",
        aggregateId: "pay-1",
        payload: {},
      }),
    ).toBeNull();

    const legacy = buildLegacyXeroCommandFromEvent({
      id: 2,
      eventType: "payout.paid",
      aggregateId: "po-1",
      payload: {},
    });
    expect(legacy).toEqual(
      expect.objectContaining({ operation: "payout_bill", aggregateId: "po-1" }),
    );
  });
});

describe("diffXeroShadowCommand", () => {
  it("flags new operations vs legacy projector", () => {
    const projected = buildXeroCommandFromEvent({
      id: 3,
      eventType: "payment.captured",
      aggregateId: "pay-1",
      payload: {},
    });
    expect(projected).not.toBeNull();
    if (!projected) return;
    const legacy = buildLegacyXeroCommandFromEvent({
      id: 3,
      eventType: "payment.captured",
      aggregateId: "pay-1",
      payload: {},
    });
    expect(diffXeroShadowCommand(projected, legacy).equal).toBe(false);
  });

  it("detects matching payout.paid commands", () => {
    const event = {
      id: 5,
      eventType: "payout.paid",
      aggregateId: "po-1",
      payload: {},
    };
    const projected = buildXeroCommandFromEvent(event);
    const legacy = buildLegacyXeroCommandFromEvent(event);
    expect(projected).not.toBeNull();
    expect(legacy).not.toBeNull();
    if (!projected || !legacy) return;
    expect(diffXeroShadowCommand(projected, legacy).equal).toBe(true);
  });
});

describe("executeXeroLiveCommand", () => {
  it("dispatches to the matching port", async () => {
    const recordStripeCapture = vi.fn().mockResolvedValue(undefined);
    const ports = {
      recordStripeCapture,
      recordRefundCreditNote: vi.fn(),
      ensureLotInvoice: vi.fn(),
      syncPayoutBill: vi.fn(),
      acknowledgePayoutSettlement: vi.fn(),
    };

    const command = buildXeroCommandFromEvent({
      id: 9,
      eventType: "payment.captured",
      aggregateId: "pay-9",
      payload: {},
    });
    expect(command).not.toBeNull();
    if (!command) return;

    await executeXeroLiveCommand(ports, command, { warn: vi.fn() } as never);
    expect(recordStripeCapture).toHaveBeenCalledWith("pay-9");
  });
});
