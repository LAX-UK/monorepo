import { buildListHref } from "@/lib/admin/admin-list-params";
import { isoDate } from "@/lib/admin/iso-date";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";
import type { DataView as StaffDataView, StatusPresentation } from "@auction/staff-ui";

export const VENUES_LIST_PATH = "/admin/venues";

export type VenuesListSearch = Record<string, string | string[] | undefined>;

/** One venue as the staff list shows it; plain data, so it crosses to the client as is. */
export type VenuesStaffRow = {
  id: string;
  name: string;
  /** "/barnes-gallery", when the venue has one. */
  slugLabel: string | null;
  organisationId: string;
  /** The legal entity that owns the venue. */
  organisation: string;
  organisationHref: string;
  /** "12 Beach Road, Whitstable, CT5 1AA". */
  address: string;
  status: StatusPresentation;
  archived: boolean;
  capacity: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  href: string;
  editHref: string;
};

const count = new Intl.NumberFormat("en-GB");

export function venueAddress(
  venue: Pick<AdminVenueListRow, "addressLine1" | "addressLine2" | "city" | "postcode">,
): string {
  return [venue.addressLine1, venue.addressLine2, venue.city, venue.postcode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function toVenuesStaffRows(venues: readonly AdminVenueListRow[]): VenuesStaffRow[] {
  return venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    slugLabel: venue.slug ? `/${venue.slug}` : null,
    organisationId: venue.legalEntityId,
    organisation: venue.legalEntityDisplayName?.trim() || "Unknown organisation",
    organisationHref: `/admin/legal-entities/${venue.legalEntityId}`,
    address: venueAddress(venue),
    status: staffStatus("venue", venue.status),
    archived: venue.status === "archived",
    capacity: venue.capacity,
    phone: venue.contactPhone,
    email: venue.contactEmail,
    website: venue.website,
    createdAt: isoDate(venue.createdAt),
    updatedAt: isoDate(venue.updatedAt),
    href: `${VENUES_LIST_PATH}/${venue.id}`,
    editHref: `${VENUES_LIST_PATH}/${venue.id}/edit`,
  }));
}

/** The list URL with `patch` applied; any change returns to the first page. */
export function venuesListHref(
  current: VenuesListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: VenuesListSearch = { ...current };
  for (const key of ["error", "success", "venue", "new"]) delete base[key];
  return buildListHref(VENUES_LIST_PATH, base, { offset: null, ...patch });
}

/** The list with a venue's panel open (`?venue=`), or closed for null; keeps the page. */
export function venuePanelHref(current: VenuesListSearch, id: string | null): string {
  const base: VenuesListSearch = { ...current };
  for (const key of ["error", "success", "new"]) delete base[key];
  return buildListHref(VENUES_LIST_PATH, base, { venue: id });
}

/** Active venues, or every venue with the archived ones. */
export function venuesViews(search: VenuesListSearch): StaffDataView[] {
  return [
    { id: "active", label: "Active", href: venuesListHref(search, { includeArchived: null }) },
    {
      id: "archived",
      label: "Include archived",
      href: venuesListHref(search, { includeArchived: "true" }),
    },
  ];
}

export function venuesActiveView(includeArchived: boolean): string {
  return includeArchived ? "archived" : "active";
}

/**
 * The filters in force beyond the view tab and the search: the organisation. Its name is shown
 * when it could be resolved.
 */
export function venuesFilterChips(
  search: VenuesListSearch,
  organisation: { id: string | null; name: string | null },
): Array<{ id: string; label: string; clearHref: string }> {
  if (!organisation.id) return [];
  return [
    {
      id: "legalEntityId",
      label: organisation.name ? `Organisation: ${organisation.name}` : "Organisation",
      clearHref: venuesListHref(search, { legalEntityId: null }),
    },
  ];
}

/** "1–50 of 312 venues", with the singular for exactly one. */
export function venuesRangeSummary(offset: number, shown: number, total: number): string {
  const range = `${count.format(offset + 1)}–${count.format(offset + shown)}`;
  return `${range} of ${count.format(total)} ${total === 1 ? "venue" : "venues"}`;
}

/** "120 people", for the panel; null when the capacity is not recorded. */
export function capacityLabel(capacity: number | null): string | null {
  if (capacity === null) return null;
  return `${count.format(capacity)} ${capacity === 1 ? "person" : "people"}`;
}
