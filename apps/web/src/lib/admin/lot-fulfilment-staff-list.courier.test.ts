import { describe, expect, it } from "vitest";
import { toLotFulfilmentStaffRows } from "./lot-fulfilment-staff-list.vm";

const base = {
  id: "r1",
  lotId: "lot_1",
  lotTitle: "Blue Interior",
  lotNumber: 4,
  saleId: null,
  saleTitle: null,
  updatedAt: "2026-11-10T09:00:00.000Z",
  status: "released",
  paymentId: null,
  fulfilmentMethod: "shipping",
  shippingCarrier: null,
  trackingNumber: null,
  collectionVisit: null,
  courierPaidWithInvoice: [],
};

const paid = {
  paymentGroupId: "group-1",
  deliveryQuoteId: "quote-1",
  amount: "180.00",
  refundedPence: 0,
  paidAt: "2026-11-09T10:00:00.000Z",
};

describe("the paid-with-invoice courier marker", () => {
  it("shows nothing for a lot whose courier was not paid with the invoice", () => {
    const [row] = toLotFulfilmentStaffRows([base]);
    expect(row?.courierPaid).toEqual([]);
  });

  it("marks a courier charge paid with the invoice, with what can still go back", () => {
    const [row] = toLotFulfilmentStaffRows([{ ...base, courierPaidWithInvoice: [paid] }]);
    expect(row?.courierPaid).toEqual([
      {
        paymentGroupId: "group-1",
        deliveryQuoteId: "quote-1",
        label: "Paid with invoice · £180.00",
        remainingPence: 18000,
        remainingLabel: "£180.00",
      },
    ]);
  });

  it("says what was refunded, and that nothing is left once it all went back", () => {
    const [part] = toLotFulfilmentStaffRows([
      { ...base, courierPaidWithInvoice: [{ ...paid, refundedPence: 5000 }] },
    ]);
    expect(part?.courierPaid[0]?.label).toBe("Paid with invoice · £180.00 · £50.00 refunded");
    expect(part?.courierPaid[0]?.remainingPence).toBe(13000);
    const [all] = toLotFulfilmentStaffRows([
      { ...base, courierPaidWithInvoice: [{ ...paid, refundedPence: 18000 }] },
    ]);
    expect(all?.courierPaid[0]?.label).toBe("Paid with invoice · £180.00 · refunded");
    expect(all?.courierPaid[0]?.remainingPence).toBe(0);
  });
});
