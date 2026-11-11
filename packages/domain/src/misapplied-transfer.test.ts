import { describe, expect, it } from "vitest";
import {
  type LedgerEntry,
  isSameInvoiceMoney,
  isTransferAppliedToOtherPayment,
  referenceIssuedIn,
  supplyBehindApplication,
} from "./misapplied-transfer.js";

describe("isTransferAppliedToOtherPayment", () => {
  it("is a mismatch when the sender quoted something other than the payment's reference", () => {
    expect(
      isTransferAppliedToOtherPayment({ sentWithReference: "A1B2", paymentOwnReference: "C3D4" }),
    ).toBe(true);
  });
  it("ignores case, spaces and dashes, and text the bank put around the reference", () => {
    expect(
      isTransferAppliedToOtherPayment({
        sentWithReference: " ref-1 ",
        paymentOwnReference: "REF1",
      }),
    ).toBe(false);
    expect(
      isTransferAppliedToOtherPayment({
        sentWithReference: "FPS J SMITH R7WQ KX5C",
        paymentOwnReference: "R7WQKX5C",
      }),
    ).toBe(false);
  });
  it("says nothing when either reference is missing or blank", () => {
    expect(
      isTransferAppliedToOtherPayment({ sentWithReference: null, paymentOwnReference: "B" }),
    ).toBe(false);
    expect(
      isTransferAppliedToOtherPayment({ sentWithReference: "A", paymentOwnReference: null }),
    ).toBe(false);
    expect(
      isTransferAppliedToOtherPayment({ sentWithReference: "  ", paymentOwnReference: "B" }),
    ).toBe(false);
  });
});

describe("supplyBehindApplication", () => {
  const funded = (id: string, reference: string | null): LedgerEntry => ({
    kind: "funded",
    id,
    reference,
  });
  const other = (id: string): LedgerEntry => ({ kind: "other", id });
  const unapplied = (id: string, paymentIntentId: string): LedgerEntry => ({
    kind: "unapplied",
    id,
    paymentIntentId,
  });

  it("is the first transfer or take-back behind the application, skipping other applications", () => {
    expect(
      supplyBehindApplication([other("a1"), other("a2"), funded("f", "R"), funded("older", "O")]),
    ).toEqual({ kind: "funded", reference: "R" });
  });
  it("is the payment the money was taken back from when that comes first", () => {
    expect(supplyBehindApplication([unapplied("u", "pi_cancelled"), funded("f", "R")])).toEqual({
      kind: "unapplied",
      paymentIntentId: "pi_cancelled",
    });
  });
  it("is null when the window holds neither", () => {
    expect(supplyBehindApplication([other("a")])).toBeNull();
    expect(supplyBehindApplication([])).toBeNull();
  });
  it("keeps a funded entry without a reference as the source", () => {
    expect(supplyBehindApplication([funded("f", null)])).toEqual({
      kind: "funded",
      reference: null,
    });
  });
});

describe("referenceIssuedIn", () => {
  const issued = [{ reference: "ABC123" }, { reference: "ABC123XYZ9" }];
  it("finds the longest issued reference the sent text contains", () => {
    expect(referenceIssuedIn("pay abc123-xyz9 thanks", issued)).toBe(issued[1]);
  });
  it("is null for text that holds none of ours", () => {
    expect(referenceIssuedIn("INVOICE 55", issued)).toBeNull();
  });
});

describe("isSameInvoiceMoney", () => {
  const none = () => [] as string[];
  it("is the same payment or the same combined payment", () => {
    expect(
      isSameInvoiceMoney(
        { paymentId: "p1", paymentGroupId: null },
        { paymentId: "p1", paymentGroupId: null },
        none,
      ),
    ).toBe(true);
    expect(
      isSameInvoiceMoney(
        { paymentId: null, paymentGroupId: "g" },
        { paymentId: null, paymentGroupId: "g" },
        none,
      ),
    ).toBe(true);
  });
  it("is an invoice and the combined payment that holds it, either way round", () => {
    const members = (g: string) => (g === "g" ? ["p1", "p2"] : []);
    expect(
      isSameInvoiceMoney(
        { paymentId: "p1", paymentGroupId: null },
        { paymentId: null, paymentGroupId: "g" },
        members,
      ),
    ).toBe(true);
    expect(
      isSameInvoiceMoney(
        { paymentId: null, paymentGroupId: "g" },
        { paymentId: "p2", paymentGroupId: null },
        members,
      ),
    ).toBe(true);
  });
  it("is not for two unrelated payments", () => {
    expect(
      isSameInvoiceMoney(
        { paymentId: "p1", paymentGroupId: null },
        { paymentId: "p9", paymentGroupId: null },
        none,
      ),
    ).toBe(false);
  });
});
