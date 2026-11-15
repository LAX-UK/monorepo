import { describe, expect, it } from "vitest";
import { collectionLabel, toLotFulfilmentStaffRows } from "./lot-fulfilment-staff-list.vm";

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
  fulfilmentMethod: "collection",
  shippingCarrier: null,
  trackingNumber: null,
  collectionVisit: null,
};

describe("the Collection column", () => {
  it("draws the booked visit in London time", () => {
    const [row] = toLotFulfilmentStaffRows([
      {
        ...base,
        collectionVisit: {
          start: "2026-11-12T14:00:00.000Z",
          end: "2026-11-12T14:30:00.000Z",
        },
      },
    ]);
    expect(row?.collection).toBe("Thu 12 Nov, 14:00–14:30 GMT");
    expect(collectionLabel(row as never)).toBe("Thu 12 Nov, 14:00–14:30 GMT");
  });

  it("says Not booked for a collection lot still waiting to be handed over", () => {
    for (const status of ["released", "ready_for_collection"]) {
      const [row] = toLotFulfilmentStaffRows([{ ...base, status }]);
      expect(collectionLabel(row as never)).toBe("Not booked");
    }
  });

  it("is blank for a lot that is collected, delivered or cancelled", () => {
    for (const status of ["delivered", "cancelled", "awaiting_payment", "awaiting_release"]) {
      const [row] = toLotFulfilmentStaffRows([{ ...base, status }]);
      expect(collectionLabel(row as never)).toBeNull();
    }
  });

  it("is blank for a lot that ships", () => {
    const [row] = toLotFulfilmentStaffRows([{ ...base, fulfilmentMethod: "shipping" }]);
    expect(collectionLabel(row as never)).toBeNull();
  });

  it("is blank while the method is not chosen yet", () => {
    const [row] = toLotFulfilmentStaffRows([{ ...base, fulfilmentMethod: null }]);
    expect(collectionLabel(row as never)).toBeNull();
  });
});
