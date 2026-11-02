import { describe, expect, it } from "vitest";
import { purchaseRowStep } from "./purchase-row-step";

const base = { title: "Red Kite", amount: "£1,875.00", payable: null, primaryAction: null };

describe("purchaseRowStep", () => {
  it("pays an invoice the member can pay, naming the amount", () => {
    expect(purchaseRowStep({ ...base, payable: { totalDue: "1875.00", currency: "GBP" } })).toEqual(
      { kind: "pay", label: "Pay £1,875.00", accessibleName: "Pay £1,875.00, Red Kite" },
    );
  });

  it("opens the purchase's next step when there is nothing to pay", () => {
    expect(
      purchaseRowStep({
        ...base,
        primaryAction: { label: "Arrange delivery", href: "/checkout/lot-1" },
      }),
    ).toEqual({
      kind: "link",
      label: "Arrange delivery",
      href: "/checkout/lot-1",
      accessibleName: "Arrange delivery, Red Kite",
    });
  });

  it("offers nothing when nothing waits on the member", () => {
    expect(purchaseRowStep(base)).toBeNull();
  });
});
