/** Catalog routes that render their own `CatalogBreadcrumbs` — hide shell trail to avoid duplication. */
const CATALOG_BREADCRUMB_PREFIXES = [
  "/admin/sales",
  "/admin/lots",
  "/admin/submissions",
  "/admin/artists",
  "/admin/categories",
  "/admin/venues",
  "/admin/condition-reports",
] as const;

export function shouldHideStaffBreadcrumbs(pathname: string): boolean {
  return CATALOG_BREADCRUMB_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
