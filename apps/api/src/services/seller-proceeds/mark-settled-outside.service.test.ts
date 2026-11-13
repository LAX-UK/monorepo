import type { StaffLotSellerProceedsFacts } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { MarkSettledOutsideService } from "./mark-settled-outside.service.js";
import { SellerProceedsError } from "./seller-proceeds-errors.js";

const LOT = "0d6f1f8e-6a55-4c11-9c76-0d1c1e7b2a01";
const PAYMENT = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

function facts(soldOnAtg: boolean): StaffLotSellerProceedsFacts {
  return {
    lotId: LOT,
    lotNumber: 30,
    lotTitle: "Fixture",
    sellerLegalEntityId: "s",
    sellerName: "Fixture Seller",
    soldOnAtg,
    settledOutsideAt: null,
    sale: {
      paymentId: PAYMENT,
      paymentStatus: "captured",
      terms: { sellerNetPence: 530_720 } as never,
      invoice: null,
      payout: null,
      refundedAfterPayout: false,
      reawarded: false,
    },
    agreement: null,
    submissionId: null,
    vatSetting: "standard",
  };
}

function setup(found: StaffLotSellerProceedsFacts | null) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const service = new MarkSettledOutsideService({
    reader: { forLot: vi.fn().mockResolvedValue(found) },
    events: { publish },
  });
  return { service, publish };
}

const input = { lotId: LOT, reason: "Paid by bank transfer per runbook", actorUserId: "staff-1" };

describe("MarkSettledOutsideService", () => {
  it("writes the audit entry with the seller's figure from the snapshot", async () => {
    const { service, publish } = setup(facts(true));
    await service.mark(input);
    expect(publish).toHaveBeenCalledWith({
      aggregateType: "lot",
      aggregateId: LOT,
      eventType: "lot.seller_settled_outside_lax",
      actorUserId: "staff-1",
      schemaVersion: 1,
      payload: {
        lotId: LOT,
        paymentId: PAYMENT,
        reason: "Paid by bank transfer per runbook",
        sellerNetPence: 530_720,
      },
    });
  });

  it.each([
    ["a short reason", facts(true), { reason: "short" }, "reason_required"],
    ["a lot not sold on ATG", facts(false), {}, "not_sold_on_atg"],
    ["a missing lot", null, {}, "lot_not_found"],
  ] as const)("refuses %s", async (_name, found, over, code) => {
    const { service, publish } = setup(found);
    const error = await service.mark({ ...input, ...over }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SellerProceedsError);
    expect((error as SellerProceedsError).code).toBe(code);
    expect(publish).not.toHaveBeenCalled();
  });
});
