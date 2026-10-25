import { describe, expect, it } from "vitest";
import {
  buildAdminLotFulfilmentSearchParams,
  parseAdminLotFulfilmentPageBody,
} from "./admin-lot-fulfilment.shared";

describe("parseAdminLotFulfilmentPageBody", () => {
  it("parses standard list envelope with meta.summary", () => {
    const page = parseAdminLotFulfilmentPageBody(
      {
        data: [
          {
            id: "f1",
            lotId: "lot-1",
            lotTitle: "Vase",
            lotNumber: 12,
            saleId: "sale-1",
            saleTitle: "Autumn sale",
            updatedAt: "2026-10-20T09:30:00.000Z",
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
    expect(page.rows[0]).toMatchObject({
      lotNumber: 12,
      saleId: "sale-1",
      saleTitle: "Autumn sale",
      updatedAt: "2026-10-20T09:30:00.000Z",
    });
  });

  it("reads a lot without a number or sale as nulls", () => {
    const page = parseAdminLotFulfilmentPageBody(
      {
        data: [
          {
            id: "f2",
            lotId: "lot-2",
            lotTitle: "Print",
            lotNumber: null,
            saleId: null,
            saleTitle: null,
            updatedAt: "2026-10-20T09:30:00.000Z",
            status: "delivered",
            paymentId: null,
            fulfilmentMethod: null,
            shippingCarrier: null,
            trackingNumber: null,
          },
        ],
        meta: {
          total: 1,
          summary: { total: 1, awaitingPickup: 0, inTransit: 0, statusCounts: {} },
        },
      },
      { limit: 50, offset: 0 },
    );
    expect(page.rows[0]).toMatchObject({ lotNumber: null, saleId: null, saleTitle: null });
  });
});

describe("buildAdminLotFulfilmentSearchParams", () => {
  it("sends a non-default sort and omits the default", () => {
    expect(
      buildAdminLotFulfilmentSearchParams({ limit: 50, offset: 0, sort: "lot_asc" }).get("sort"),
    ).toBe("lot_asc");
    expect(
      buildAdminLotFulfilmentSearchParams({ limit: 50, offset: 0, sort: "updated_desc" }).has(
        "sort",
      ),
    ).toBe(false);
  });
});
