import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";

export function buildArtistsActiveFilterChips(
  sp: SearchParams,
  ctx: {
    q?: string;
    status?: string;
    kind?: string;
    sort?: string;
    featured?: boolean;
    verified?: boolean;
    includeArchived?: boolean;
    archivedOnly?: boolean;
    linked?: "yes" | "no";
    categoryId?: string;
    categoryName?: string | null;
    country?: string;
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const base = "/admin/artists";

  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref(base, sp, ["q"]),
    });
  }
  if (ctx.status?.trim()) {
    chips.push({
      id: "status",
      label: `Status: ${ctx.status}`,
      clearHref: omitParamsHref(base, sp, ["status"]),
    });
  }
  if (ctx.kind?.trim()) {
    chips.push({
      id: "kind",
      label: `Kind: ${ctx.kind}`,
      clearHref: omitParamsHref(base, sp, ["kind"]),
    });
  }
  if (ctx.categoryId?.trim()) {
    chips.push({
      id: "categoryId",
      label: ctx.categoryName
        ? `Department: ${ctx.categoryName}`
        : `Department ID ${ctx.categoryId.slice(0, 8)}…`,
      clearHref: omitParamsHref(base, sp, ["categoryId"]),
    });
  }
  if (ctx.country?.trim()) {
    chips.push({
      id: "country",
      label: `Country: ${ctx.country}`,
      clearHref: omitParamsHref(base, sp, ["country"]),
    });
  }
  if (ctx.sort && ctx.sort !== "name_asc") {
    chips.push({
      id: "sort",
      label: `Sort: ${ctx.sort}`,
      clearHref: omitParamsHref(base, sp, ["sort"]),
    });
  }
  if (ctx.featured) {
    chips.push({
      id: "featured",
      label: "Featured",
      clearHref: omitParamsHref(base, sp, ["featured"]),
    });
  }
  if (ctx.verified) {
    chips.push({
      id: "verified",
      label: "Verified",
      clearHref: omitParamsHref(base, sp, ["verified"]),
    });
  }
  if (ctx.includeArchived) {
    chips.push({
      id: "includeArchived",
      label: "Include archived",
      clearHref: omitParamsHref(base, sp, ["includeArchived"]),
    });
  }
  if (ctx.archivedOnly) {
    chips.push({
      id: "archivedOnly",
      label: "Archived only",
      clearHref: omitParamsHref(base, sp, ["archivedOnly", "includeArchived"]),
    });
  }
  if (ctx.linked) {
    chips.push({
      id: "linked",
      label: ctx.linked === "yes" ? "Linked account" : "No linked account",
      clearHref: omitParamsHref(base, sp, ["linked"]),
    });
  }

  return chips;
}
