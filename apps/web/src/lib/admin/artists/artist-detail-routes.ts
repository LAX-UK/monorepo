export const ARTIST_DETAIL_TABS = ["overview", "lots", "duplicates", "review"] as const;

export type ArtistDetailTab = (typeof ARTIST_DETAIL_TABS)[number];

export function artistDetailTabHref(artistId: string, tab: ArtistDetailTab): string {
  if (tab === "overview") return `/admin/artists/${artistId}`;
  return `/admin/artists/${artistId}/${tab}`;
}

export function parseArtistDetailTabFromPath(pathname: string, artistId: string): ArtistDetailTab {
  const prefix = `/admin/artists/${artistId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "overview";
  for (const tab of ARTIST_DETAIL_TABS) {
    if (tab === "overview") continue;
    if (pathname === `${prefix}/${tab}` || pathname.startsWith(`${prefix}/${tab}/`)) {
      return tab;
    }
  }
  return "overview";
}
