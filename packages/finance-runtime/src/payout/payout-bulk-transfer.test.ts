import { describe, expect, it } from "vitest";
import { outcomeFromTransfer } from "./payout-bulk-transfer.js";

describe("outcomeFromTransfer", () => {
  const entityId = "le_1";
  const payoutId = "po_1";

  it("maps successful transfer to transfer_initiated", () => {
    expect(
      outcomeFromTransfer(entityId, payoutId, { ok: true, stripeTransferId: "tr_1" }, false),
    ).toMatchObject({
      outcome: "transfer_initiated",
      stripeTransferId: "tr_1",
    });
  });

  it("maps connect_not_ready outcome", () => {
    expect(
      outcomeFromTransfer(entityId, payoutId, { ok: false, reason: "connect_not_ready" }, true),
    ).toEqual({
      legalEntityId: entityId,
      payoutId,
      resume: true,
      outcome: "connect_not_ready",
    });
  });

  it("maps stripe_error with code", () => {
    expect(
      outcomeFromTransfer(
        entityId,
        payoutId,
        {
          ok: false,
          reason: "stripe_error",
          stripeErrorCode: "rate_limit",
          stripeErrorMessage: "Too many requests",
        },
        false,
      ),
    ).toMatchObject({
      outcome: "transfer_failed",
      stripeErrorCode: "rate_limit",
      reason: "Too many requests",
    });
  });
});
