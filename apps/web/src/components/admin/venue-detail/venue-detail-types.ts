export const VENUE_DETAIL_TABS = ["overview", "sales", "activity"] as const;

export type VenueDetailTab = (typeof VENUE_DETAIL_TABS)[number];

export function venueDetailTabHref(venueId: string, tab: VenueDetailTab): string {
  if (tab === "overview") return `/admin/venues/${venueId}`;
  return `/admin/venues/${venueId}/${tab}`;
}

export function venueEditHref(venueId: string): string {
  return `/admin/venues/${venueId}/edit`;
}

export function parseVenueDetailTabFromPath(pathname: string, venueId: string): VenueDetailTab {
  const prefix = `/admin/venues/${venueId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "overview";
  if (pathname.startsWith(`${prefix}/edit`)) return "overview";
  for (const tab of VENUE_DETAIL_TABS) {
    if (tab === "overview") continue;
    if (pathname === `${prefix}/${tab}` || pathname.startsWith(`${prefix}/${tab}/`)) {
      return tab;
    }
  }
  return "overview";
}
