import { describe, expect, it } from "vitest";
import {
  type TransferFunding,
  fundingThatSuppliedApplication,
  isTransferAppliedToOtherPayment,
} from "./misapplied-transfer.js";

const f = (id: string, createdAt: number, reference: string | null): TransferFunding => ({
  id,
  createdAt,
  reference,
});

describe("isTransferAppliedToOtherPayment", () => {
  it("is a mismatch when the references differ", () => {
    expect(
      isTransferAppliedToOtherPayment({ sentWithReference: "A", paymentOwnReference: "B" }),
    ).toBe(true);
  });
  it("ignores case and surrounding space", () => {
    expect(
      isTransferAppliedToOtherPayment({
        sentWithReference: " ref-1 ",
        paymentOwnReference: "REF-1",
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

describe("fundingThatSuppliedApplication", () => {
  it("picks the latest transfer received at or before the application", () => {
    const fundings = [f("c", 3000, "C"), f("b", 2000, "B"), f("a", 1000, "A")];
    expect(fundingThatSuppliedApplication(fundings, 2500)?.id).toBe("b");
    expect(fundingThatSuppliedApplication(fundings, 2000)?.id).toBe("b");
  });
  it("is null when none preceded it, or the one that did quoted no reference", () => {
    expect(fundingThatSuppliedApplication([f("a", 1000, "A")], 500)).toBeNull();
    expect(fundingThatSuppliedApplication([f("a", 1000, null)], 1500)).toBeNull();
    expect(fundingThatSuppliedApplication([], 1500)).toBeNull();
  });
});
