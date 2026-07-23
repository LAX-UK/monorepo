export const CATEGORY_DETAIL_TABS = ["overview", "children", "lots", "sales", "activity"] as const;

export type CategoryDetailTab = (typeof CATEGORY_DETAIL_TABS)[number];

export function categoryDetailTabHref(categoryId: string, tab: CategoryDetailTab): string {
  if (tab === "overview") return `/admin/categories/${categoryId}`;
  return `/admin/categories/${categoryId}/${tab}`;
}

export function categoryEditHref(categoryId: string): string {
  return `/admin/categories/${categoryId}/edit`;
}

export function categorySubmissionsHref(categoryId: string): string {
  return `/admin/submissions?categoryId=${encodeURIComponent(categoryId)}`;
}

export function parseCategoryDetailTabFromPath(
  pathname: string,
  categoryId: string,
): CategoryDetailTab {
  const prefix = `/admin/categories/${categoryId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "overview";
  if (pathname.startsWith(`${prefix}/edit`)) return "overview";
  for (const tab of CATEGORY_DETAIL_TABS) {
    if (tab === "overview") continue;
    if (pathname === `${prefix}/${tab}` || pathname.startsWith(`${prefix}/${tab}/`)) {
      return tab;
    }
  }
  return "overview";
}
