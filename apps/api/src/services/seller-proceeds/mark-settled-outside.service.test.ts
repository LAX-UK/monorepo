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

function setup(
  found: StaffLotSellerProceedsFacts | null,
  inTx: StaffLotSellerProceedsFacts | null = found,
) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const lockSale = vi.fn().mockResolvedValue(undefined);
  const service = new MarkSettledOutsideService({
    reader: { forLot: vi.fn().mockResolvedValue(found) },
    unitOfWork: (work) =>
      work({
        facts: { forLot: vi.fn().mockResolvedValue(inTx) },
        locks: { lockSale },
        events: { publish },
      }),
  });
  return { service, publish, lockSale };
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

  it("refuses (409) a sale already marked, and says when", async () => {
    const marked = { ...facts(true), settledOutsideAt: new Date("2026-11-12T15:30:00Z") };
    const { service, publish } = setup(marked);
    const error = await service.mark(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SellerProceedsError);
    expect((error as SellerProceedsError).status).toBe(409);
    expect((error as SellerProceedsError).code).toBe("already_settled_outside");
    expect((error as SellerProceedsError).message).toBe(
      "This sale was already marked as settled outside LAX on 12/11/2026.",
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("refuses the second of two clicks: the mark is read again under the payment's lock", async () => {
    const markedMeanwhile = { ...facts(true), settledOutsideAt: new Date("2026-11-13T09:00:00Z") };
    const { service, publish, lockSale } = setup(facts(true), markedMeanwhile);
    const error = await service.mark(input).catch((e: unknown) => e);
    expect(lockSale).toHaveBeenCalledWith({ paymentId: PAYMENT, sellerTermsId: null });
    expect((error as SellerProceedsError).code).toBe("already_settled_outside");
    expect(publish).not.toHaveBeenCalled();
  });
});
