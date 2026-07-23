import { buildSaleDetailTabSpecs } from "@/lib/admin/sales/build-sale-detail-tab-specs";
import { describe, expect, it } from "vitest";

describe("buildSaleDetailTabSpecs", () => {
  const base = {
    saleId: "sale-1",
    liveish: true,
    lotCount: 5,
    saleStatus: "active" as const,
    registrationCount: 3,
    pendingRegistrationCount: 0,
    pendingTelephoneBookingCount: 0,
    documentCount: 2,
    overviewAttentionCount: 0,
  };

  it("includes saleroom-only tabs for onsite and hybrid sales", () => {
    for (const deliveryMode of ["onsite", "hybrid"] as const) {
      const tabs = buildSaleDetailTabSpecs({ ...base, deliveryMode });
      expect(tabs.map((t) => t.id)).toEqual([
        "overview",
        "lots",
        "registrations",
        "documents",
        "media",
        "press",
        "schedule",
        "operations",
        "telephone-bookings",
      ]);
    }
  });

  it("hides saleroom-only tabs for online sales", () => {
    const tabs = buildSaleDetailTabSpecs({ ...base, deliveryMode: "online" });
    expect(tabs.map((t) => t.id)).toEqual([
      "overview",
      "lots",
      "registrations",
      "documents",
      "press",
      "schedule",
    ]);
  });

  it("shows telephone pending badge only for saleroom sales", () => {
    const tabs = buildSaleDetailTabSpecs({
      ...base,
      deliveryMode: "hybrid",
      pendingTelephoneBookingCount: 2,
    });
    const telephone = tabs.find((t) => t.id === "telephone-bookings");
    expect(telephone?.badge).toBe("pending");

    const onlineTabs = buildSaleDetailTabSpecs({
      ...base,
      deliveryMode: "online",
      pendingTelephoneBookingCount: 2,
    });
    expect(onlineTabs.some((t) => t.id === "telephone-bookings")).toBe(false);
  });
});
