export const SALE_DETAIL_TABS = [
  "overview",
  "schedule",
  "lots",
  "documents",
  "registrations",
  "activity",
] as const;

export type SaleDetailTab = (typeof SALE_DETAIL_TABS)[number];

export function saleDetailTabHref(saleId: string, tab: SaleDetailTab): string {
  if (tab === "overview") return `/admin/sales/${saleId}`;
  return `/admin/sales/${saleId}/${tab}`;
}

/** Resolve active tab from a sale detail pathname. */
export function parseSaleDetailTabFromPath(pathname: string, saleId: string): SaleDetailTab {
  const prefix = `/admin/sales/${saleId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "overview";
  for (const tab of SALE_DETAIL_TABS) {
    if (tab === "overview") continue;
    if (pathname === `${prefix}/${tab}` || pathname.startsWith(`${prefix}/${tab}/`)) {
      return tab;
    }
  }
  return "overview";
}
