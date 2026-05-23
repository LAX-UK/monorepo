export const LOT_DETAIL_TABS = ["overview", "images", "documents", "bids", "activity"] as const;

export type LotDetailTab = (typeof LOT_DETAIL_TABS)[number];

export function lotDetailTabHref(lotId: string, tab: LotDetailTab): string {
  if (tab === "overview") return `/admin/lots/${lotId}`;
  return `/admin/lots/${lotId}/${tab}`;
}

export function parseLotDetailTabFromPath(pathname: string, lotId: string): LotDetailTab {
  const prefix = `/admin/lots/${lotId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "overview";
  for (const tab of LOT_DETAIL_TABS) {
    if (tab === "overview") continue;
    if (pathname === `${prefix}/${tab}` || pathname.startsWith(`${prefix}/${tab}/`)) {
      return tab;
    }
  }
  return "overview";
}
