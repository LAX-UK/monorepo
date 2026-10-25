import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";
import { describe, expect, it } from "vitest";
import {
  capacityLabel,
  toVenuesStaffRows,
  venuePanelHref,
  venuesActiveView,
  venuesFilterChips,
  venuesListHref,
  venuesRangeSummary,
  venuesViews,
} from "./venues-staff-list.vm";

const venue = {
  id: "v1",
  legalEntityId: "le1",
  legalEntityDisplayName: "London Auction Xchange LTD",
  name: "Barnes Gallery",
  slug: "barnes-gallery",
  addressLine1: "12 Beach Road",
  addressLine2: null,
  city: "Whitstable",
  postcode: "CT5 1AA",
  capacity: 120,
  contactPhone: null,
  contactEmail: null,
  website: null,
  status: "active",
  createdAt: new Date("2026-01-05T10:00:00.000Z"),
  updatedAt: new Date("2026-02-01T10:00:00.000Z"),
} as unknown as AdminVenueListRow;

describe("venues staff list view model", () => {
  it("joins the address, names the organisation and reads status in words", () => {
    const [row] = toVenuesStaffRows([venue]);
    expect(row?.address).toBe("12 Beach Road, Whitstable, CT5 1AA");
    expect(row?.organisation).toBe("London Auction Xchange LTD");
    expect(row?.organisationHref).toBe("/admin/legal-entities/le1");
    expect(row?.slugLabel).toBe("/barnes-gallery");
    expect(row?.status.label).toBe("Active");
    expect(row?.archived).toBe(false);
    expect(row?.href).toBe("/admin/venues/v1");
    expect(row?.editHref).toBe("/admin/venues/v1/edit");
  });

  it("copes with a missing organisation name, slug and archived status", () => {
    const [row] = toVenuesStaffRows([
      { ...venue, legalEntityDisplayName: null, slug: null, status: "archived" },
    ]);
    expect(row?.organisation).toBe("Unknown organisation");
    expect(row?.slugLabel).toBeNull();
    expect(row?.status.label).toBe("Archived");
    expect(row?.archived).toBe(true);
  });

  it("builds list and panel URLs that return to the first page", () => {
    expect(
      venuesListHref({ offset: "50", venue: "v1", q: "barnes" }, { legalEntityId: "le1" }),
    ).toBe("/admin/venues?q=barnes&legalEntityId=le1");
    expect(venuePanelHref({ q: "barnes" }, "v1")).toBe("/admin/venues?q=barnes&venue=v1");
    expect(venuePanelHref({ q: "barnes", venue: "v1" }, null)).toBe("/admin/venues?q=barnes");
  });

  it("offers the archive lens as a tab", () => {
    const [active, all] = venuesViews({ q: "barnes" });
    expect(active?.href).toBe("/admin/venues?q=barnes");
    expect(all?.href).toBe("/admin/venues?q=barnes&includeArchived=true");
    expect(venuesActiveView(true)).toBe("archived");
    expect(venuesActiveView(false)).toBe("active");
  });

  it("shows the organisation as a removable chip, named when known", () => {
    const search = { legalEntityId: "le1", q: "barnes" };
    expect(venuesFilterChips(search, { id: null, name: null })).toEqual([]);
    expect(venuesFilterChips(search, { id: "le1", name: "LAX" })).toEqual([
      { id: "legalEntityId", label: "Organisation: LAX", clearHref: "/admin/venues?q=barnes" },
    ]);
    expect(venuesFilterChips(search, { id: "le1", name: null })[0]?.label).toBe("Organisation");
  });

  it("summarises the range and capacity with the right plurals", () => {
    expect(venuesRangeSummary(0, 50, 312)).toBe("1–50 of 312 venues");
    expect(venuesRangeSummary(0, 1, 1)).toBe("1–1 of 1 venue");
    expect(capacityLabel(null)).toBeNull();
    expect(capacityLabel(1)).toBe("1 person");
    expect(capacityLabel(1200)).toBe("1,200 people");
  });
});
