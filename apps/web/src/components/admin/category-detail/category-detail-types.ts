export const CATEGORY_DETAIL_TABS = ["overview", "edit", "children", "lots"] as const;

export type CategoryDetailTab = (typeof CATEGORY_DETAIL_TABS)[number];

export function categoryDetailTabHref(categoryId: string, tab: CategoryDetailTab): string {
  if (tab === "overview") return `/admin/categories/${categoryId}`;
  return `/admin/categories/${categoryId}/${tab}`;
}

export function parseCategoryDetailTabFromPath(
  pathname: string,
  categoryId: string,
): CategoryDetailTab {
  const prefix = `/admin/categories/${categoryId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "overview";
  for (const tab of CATEGORY_DETAIL_TABS) {
    if (tab === "overview") continue;
    if (pathname === `${prefix}/${tab}` || pathname.startsWith(`${prefix}/${tab}/`)) {
      return tab;
    }
  }
  return "overview";
}
