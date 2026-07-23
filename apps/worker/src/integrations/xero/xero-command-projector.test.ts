import { describe, expect, it } from "vitest";
import {
  buildLegacyXeroCommandFromEvent,
  buildXeroCommandFromEvent,
  diffXeroShadowCommand,
} from "./xero-command-projector.js";

describe("buildXeroCommandFromEvent", () => {
  it("builds stable idempotency keys from event id", () => {
    const cmd = buildXeroCommandFromEvent({
      id: 42,
      eventType: "payment.captured",
      aggregateId: "pay-1",
      payload: {},
    });
    expect(cmd).toEqual(
      expect.objectContaining({
        operation: "payment_captured",
        idempotencyKey: "xero:payment_captured:42",
      }),
    );
  });

  it("returns null for unsupported events", () => {
    expect(
      buildXeroCommandFromEvent({
        id: 1,
        eventType: "user.registered",
        aggregateId: "u1",
        payload: {},
      }),
    ).toBeNull();
  });
});

describe("diffXeroShadowCommand", () => {
  it("detects matching shadow commands", () => {
    const projected = buildXeroCommandFromEvent({
      id: 5,
      eventType: "payout.paid",
      aggregateId: "po-1",
      payload: {},
    });
    expect(projected).not.toBeNull();
    if (!projected) return;
    const legacy = buildLegacyXeroCommandFromEvent({
      id: 5,
      eventType: "payout.paid",
      aggregateId: "po-1",
      payload: {},
    });
    expect(legacy).not.toBeNull();
    if (!legacy) return;
    expect(diffXeroShadowCommand(projected, legacy).equal).toBe(true);
  });
});
