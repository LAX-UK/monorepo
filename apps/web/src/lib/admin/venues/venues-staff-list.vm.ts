import { buildListHref } from "@/lib/admin/admin-list-params";
import { isoDate } from "@/lib/admin/iso-date";
import { panelParamRedirect } from "@/lib/admin/list-record";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";
import {
  type SortState,
  type DataView as StaffDataView,
  type StatusPresentation,
  decodeSort,
  encodeSort,
} from "@auction/staff-ui";

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

/** A venue's page. */
export function venueHref(id: string): string {
  return `${VENUES_LIST_PATH}/${id}`;
}

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
    href: venueHref(venue.id),
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

/**
 * An old panel link (`/admin/venues?venue=ID`) opens the venue's page now, still in the list it
 * named; null when there is no `?venue=`.
 */
export function venuePanelRedirect(current: VenuesListSearch): string | null {
  return panelParamRedirect(current, "venue", venueHref);
}

/** By name, A to Z, unless the URL says otherwise; the default is left out of the URL. */
export const VENUES_DEFAULT_SORT: SortState = { columnId: "venue", direction: "asc" };

const VENUES_SORTABLE = ["venue", "organisation", "updated"] as const;

/** The sort in the URL (`?sort=-updated`), or the default for a missing or unknown one. */
export function venuesSortState(sort: string | string[] | undefined): SortState {
  const decoded = decodeSort(typeof sort === "string" ? sort : sort?.[0]);
  return decoded && (VENUES_SORTABLE as readonly string[]).includes(decoded.columnId)
    ? decoded
    : VENUES_DEFAULT_SORT;
}

/** The list sorted by a column, back on its first page. */
export function venuesSortHref(current: VenuesListSearch, sort: SortState): string {
  const isDefault =
    sort.columnId === VENUES_DEFAULT_SORT.columnId &&
    sort.direction === VENUES_DEFAULT_SORT.direction;
  return venuesListHref(current, { sort: isDefault ? null : encodeSort(sort) });
}

function compareVenues(a: VenuesStaffRow, b: VenuesStaffRow, columnId: string): number {
  if (columnId === "updated") {
    return a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0;
  }
  const key = (row: VenuesStaffRow) =>
    (columnId === "organisation" ? row.organisation : row.name).toLocaleLowerCase("en-GB");
  return key(a).localeCompare(key(b), "en-GB");
}

/**
 * The page of venues in the URL's order. The venues API does not sort, so the server sorts the
 * rows it loaded; ties keep the API's order.
 */
export function sortVenuesStaffRows(
  rows: readonly VenuesStaffRow[],
  sort: SortState,
): VenuesStaffRow[] {
  const sign = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => sign * compareVenues(a, b, sort.columnId));
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
