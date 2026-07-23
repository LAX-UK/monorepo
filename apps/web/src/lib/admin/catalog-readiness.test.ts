import type { Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildSalePublishReadiness } from "./catalog-readiness";

const saleId = "10000000-0000-4000-8000-000000000001";

function baseSale(overrides: Partial<Sale> = {}): Sale {
  const start = new Date("2030-06-01T10:00:00Z");
  const end = new Date("2030-06-07T18:00:00Z");
  return {
    id: saleId,
    title: "Test sale",
    description: null,
    status: "draft",
    deliveryMode: "online",
    allowOnlineBidsBeforeGoLive: false,
    startTime: start,
    endTime: end,
    previewStartTime: null,
    streamUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    coverImages: [],
    categoryIds: [],
    createdByLegalEntityId: "seller-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Sale;
}

function snapshotItems(sale: Sale, lotCount: number, pendingRegistrationCount: number | null) {
  return buildSalePublishReadiness(saleId, sale, lotCount, pendingRegistrationCount).items.map(
    (item) => ({
      id: item.id,
      label: item.label,
      ok: item.ok,
      severity: item.severity,
      href: item.href,
    }),
  );
}

describe("buildSalePublishReadiness characterization", () => {
  it("draft online sale with complete checks", () => {
    expect(snapshotItems(baseSale(), 2, null)).toMatchInlineSnapshot(`
      [
        {
          "href": "/admin/sales/10000000-0000-4000-8000-000000000001/lots",
          "id": "lots",
          "label": "At least one lot attached",
          "ok": true,
          "severity": "required",
        },
        {
          "href": "/admin/sales/10000000-0000-4000-8000-000000000001/schedule",
          "id": "schedule",
          "label": "Sale schedule set",
          "ok": true,
          "severity": "required",
        },
        {
          "href": "/admin/sales/10000000-0000-4000-8000-000000000001/registrations",
          "id": "registrations",
          "label": "Registrations reviewed",
          "ok": true,
          "severity": "warning",
        },
        {
          "href": "/admin/sales/10000000-0000-4000-8000-000000000001/edit",
          "id": "venue",
          "label": "Onsite venue details",
          "ok": true,
          "severity": "warning",
        },
        {
          "href": "/admin/sales/10000000-0000-4000-8000-000000000001/schedule",
          "id": "sale_start_future",
          "label": "Opening time must be in the future",
          "ok": true,
          "severity": "required",
        },
      ]
    `);
  });

  it("draft onsite sale missing venue is required", () => {
    const sale = baseSale({ deliveryMode: "onsite" });
    const venue = snapshotItems(sale, 1, null).find((item) => item.id === "venue");
    expect(venue).toEqual({
      id: "venue",
      label: "Onsite venue details",
      ok: false,
      severity: "required",
      href: `/admin/sales/${saleId}/edit`,
    });
  });

  it("draft hybrid sale treats venue as required", () => {
    const sale = baseSale({ deliveryMode: "hybrid" });
    const venue = snapshotItems(sale, 1, null).find((item) => item.id === "venue");
    expect(venue?.severity).toBe("required");
  });

  it("scheduled sale flags pending registrations", () => {
    const sale = baseSale({ status: "scheduled" });
    const regs = snapshotItems(sale, 3, 2).find((item) => item.id === "registrations");
    expect(regs).toEqual({
      id: "registrations",
      label: "Registrations reviewed",
      ok: false,
      severity: "warning",
      href: `/admin/sales/${saleId}/registrations`,
    });
  });

  it("draft sale with past start fails sale_start_future", () => {
    const sale = baseSale({
      startTime: new Date("2020-01-01T10:00:00Z"),
      endTime: new Date("2020-01-02T10:00:00Z"),
    });
    const start = snapshotItems(sale, 1, null).find((item) => item.id === "sale_start_future");
    expect(start?.ok).toBe(false);
  });
});
