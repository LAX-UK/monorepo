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
      const tabs = buildSaleDetailTabSpecs({ ...base, deliveryMode, canManageSales: true });
      expect(tabs.map((t) => t.id)).toEqual([
        "overview",
        "lots",
        "registrations",
        "documents",
        "media",
        "press",
        "atg",
        "schedule",
        "operations",
        "telephone-bookings",
      ]);
    }
  });

  it("hides saleroom-only tabs for online sales", () => {
    const tabs = buildSaleDetailTabSpecs({ ...base, deliveryMode: "online", canManageSales: true });
    expect(tabs.map((t) => t.id)).toEqual([
      "overview",
      "lots",
      "registrations",
      "documents",
      "press",
      "atg",
      "schedule",
    ]);
  });

  it("offers catalogue-only staff just the tabs whose API routes they can call", () => {
    for (const deliveryMode of ["online", "hybrid"] as const) {
      const tabs = buildSaleDetailTabSpecs({ ...base, deliveryMode, canManageSales: false });
      const ids = tabs.map((t) => t.id);
      for (const refused of ["registrations", "operations", "telephone-bookings", "atg"]) {
        expect(ids).not.toContain(refused);
      }
      expect(ids).toContain("lots");
    }
  });

  it("adds the ATG tab after press only for staff who can manage sales", () => {
    const withAtg = buildSaleDetailTabSpecs({
      ...base,
      deliveryMode: "online",
      canManageSales: true,
    });
    expect(withAtg.map((t) => t.id)).toEqual([
      "overview",
      "lots",
      "registrations",
      "documents",
      "press",
      "atg",
      "schedule",
    ]);
    const atg = withAtg.find((t) => t.id === "atg");
    expect(atg).toMatchObject({ label: "ATG", href: "/admin/sales/sale-1/atg" });
  });

  it("shows telephone pending badge only for saleroom sales", () => {
    const tabs = buildSaleDetailTabSpecs({
      ...base,
      deliveryMode: "hybrid",
      canManageSales: true,
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
