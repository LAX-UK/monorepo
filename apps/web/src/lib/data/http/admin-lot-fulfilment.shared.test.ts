import { describe, expect, it } from "vitest";
import { parseAdminLotFulfilmentPageBody } from "./admin-lot-fulfilment.shared";

describe("parseAdminLotFulfilmentPageBody", () => {
  it("parses standard list envelope with meta.summary", () => {
    const page = parseAdminLotFulfilmentPageBody(
      {
        data: [
          {
            id: "f1",
            lotId: "lot-1",
            lotTitle: "Vase",
            status: "awaiting_release",
            paymentId: null,
            fulfilmentMethod: null,
            shippingCarrier: null,
            trackingNumber: null,
          },
        ],
        meta: {
          total: 1,
          limit: 50,
          offset: 0,
          summary: {
            total: 3,
            awaitingPickup: 2,
            inTransit: 1,
            statusCounts: { awaiting_release: 2, in_transit: 1 },
          },
        },
      },
      { limit: 50, offset: 0 },
    );

    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.summary.total).toBe(3);
    expect(page.summary.awaitingPickup).toBe(2);
    expect(page.hasNextPage).toBe(false);
  });
});
