import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";
import { describe, expect, it } from "vitest";
import {
  VENUES_DEFAULT_SORT,
  capacityLabel,
  sortVenuesStaffRows,
  toVenuesStaffRows,
  venuePanelRedirect,
  venuesActiveView,
  venuesFilterChips,
  venuesListHref,
  venuesRangeSummary,
  venuesSortHref,
  venuesSortState,
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

  it("builds list URLs that return to the first page, without an old panel param", () => {
    expect(
      venuesListHref({ offset: "50", venue: "v1", q: "barnes" }, { legalEntityId: "le1" }),
    ).toBe("/admin/venues?q=barnes&legalEntityId=le1");
  });

  it("sends an old panel link to the venue's page, still in its list", () => {
    expect(venuePanelRedirect({ q: "barnes", sort: "-updated", venue: "v1" })).toBe(
      "/admin/venues/v1?list=q%3Dbarnes%26sort%3D-updated",
    );
    expect(venuePanelRedirect({ venue: "v1", success: "Saved" })).toBe("/admin/venues/v1");
    expect(venuePanelRedirect({ q: "barnes" })).toBeNull();
  });

  it("keeps the sort in the URL, leaving the default out", () => {
    expect(venuesSortState(undefined)).toEqual(VENUES_DEFAULT_SORT);
    expect(venuesSortState("-updated")).toEqual({ columnId: "updated", direction: "desc" });
    expect(venuesSortState("address")).toEqual(VENUES_DEFAULT_SORT);
    expect(
      venuesSortHref({ q: "barnes", offset: "50" }, { columnId: "organisation", direction: "asc" }),
    ).toBe("/admin/venues?q=barnes&sort=organisation");
    expect(venuesSortHref({ sort: "-updated" }, VENUES_DEFAULT_SORT)).toBe("/admin/venues");
  });

  it("sorts the loaded venues by the URL's sort, ties in the API's order", () => {
    const rows = toVenuesStaffRows([
      { ...venue, id: "a", name: "harbour", legalEntityDisplayName: "Zed" },
      {
        ...venue,
        id: "b",
        name: "Barnes",
        legalEntityDisplayName: "alpha",
        updatedAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      { ...venue, id: "c", name: "Coast", legalEntityDisplayName: "Zed" },
    ] as AdminVenueListRow[]);
    const ids = (sort: Parameters<typeof sortVenuesStaffRows>[1]) =>
      sortVenuesStaffRows(rows, sort).map((row) => row.id);
    expect(ids(VENUES_DEFAULT_SORT)).toEqual(["b", "c", "a"]);
    expect(ids({ columnId: "venue", direction: "desc" })).toEqual(["a", "c", "b"]);
    expect(ids({ columnId: "organisation", direction: "asc" })).toEqual(["b", "a", "c"]);
    expect(ids({ columnId: "updated", direction: "desc" })).toEqual(["b", "a", "c"]);
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
