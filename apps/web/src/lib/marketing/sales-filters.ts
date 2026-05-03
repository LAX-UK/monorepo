export const SALE_FILTERS = ["all", "current", "live", "active", "scheduled", "ended"] as const;
export type SaleFilter = (typeof SALE_FILTERS)[number];

export function parseSaleFilter(v: string | string[] | undefined): SaleFilter {
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (
    s === "active" ||
    s === "scheduled" ||
    s === "ended" ||
    s === "current" ||
    s === "live" ||
    s === "all"
  ) {
    return s;
  }
  return "current";
}

export function parseSalesCategoryId(
  sp: Record<string, string | string[] | undefined>,
  categories: { id: string }[],
): string | undefined {
  const raw =
    typeof sp.categoryId === "string"
      ? sp.categoryId
      : Array.isArray(sp.categoryId)
        ? sp.categoryId[0]
        : undefined;
  if (!raw) return undefined;
  return categories.some((c) => c.id === raw) ? raw : undefined;
}

export function salesHref(filter: SaleFilter, categoryId?: string): string {
  const q = new URLSearchParams();
  if (filter !== "all") {
    q.set("filter", filter);
  }
  if (categoryId) {
    q.set("categoryId", categoryId);
  }
  const qs = q.toString();
  return qs ? `/sales?${qs}` : "/sales";
}
