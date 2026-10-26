import type { OrderSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildOrderConfirmationVm, confirmationFirstName } from "./order-confirmation.vm";

const paid: OrderSummary = {
  orderId: "00000000-0000-4000-8000-000000000001",
  reference: "LAX-S-10482",
  status: "paid",
  fulfilment: "uk_insured_delivery",
  merchandiseSubtotalPence: 12000,
  fulfilmentSurchargePence: 1500,
  totalPence: 13500,
  lines: [],
  // A Friday in London.
  createdAt: "2026-10-30T10:00:00.000Z",
  paidAt: "2026-10-30T10:02:00.000Z",
  deliveryAddress: null,
  invoiceAvailable: true,
};

describe("confirmationFirstName", () => {
  it("greets by first name, never by an email address", () => {
    expect(confirmationFirstName("Robert Thorne")).toBe("Robert");
    expect(confirmationFirstName("robert@example.test")).toBeNull();
    expect(confirmationFirstName("  ")).toBeNull();
  });
});

describe("buildOrderConfirmationVm", () => {
  it("gives the reference, the receipt address and the configured delivery window", () => {
    const vm = buildOrderConfirmationVm({
      order: paid,
      displayName: "Robert Thorne",
      email: "robert@example.test",
      times: { ukDelivery: { min: 3, max: 5 }, collection: null },
    });
    expect(vm.heading).toBe("Thank you, Robert");
    expect(vm.reference).toBe("LAX-S-10482");
    expect(vm.receiptLine).toBe("A receipt is on its way to robert@example.test.");
    expect(vm.nextSteps.map((step) => step.title)).toEqual([
      "Preparation",
      "Delivery",
      "Changed your mind?",
    ]);
    expect(vm.nextSteps[1]?.text).toBe(
      "We send it by UK insured delivery and email you when it is dispatched. Expected to arrive Wed 4 Nov – Fri 6 Nov.",
    );
    expect(vm.invoiceHref).toBe(`/account/orders/${paid.orderId}/invoice`);
  });

  it("promises no time that operations have not configured", () => {
    const vm = buildOrderConfirmationVm({
      order: { ...paid, fulfilment: "collect_new_cavendish", fulfilmentSurchargePence: 0 },
      displayName: null,
      email: null,
      times: { ukDelivery: null, collection: null },
    });
    expect(vm.heading).toBe("Thank you for your order");
    expect(vm.nextSteps[1]).toEqual({
      title: "Collection",
      text: "We will contact you to arrange a time to collect it from our London gallery.",
    });
  });
});
