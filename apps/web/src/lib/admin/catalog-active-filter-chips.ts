import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { isLotListSortKey } from "@/lib/admin/lots-list-sort";

type SearchParams = Record<string, string | string[] | undefined>;

function omitParamsHref(basePath: string, sp: SearchParams, omit: readonly string[]): string {
  const patch: Record<string, string | null> = { offset: "0" };
  for (const key of omit) {
    patch[key] = null;
  }
  return buildListHref(basePath, sp, patch);
}

const LOT_SORT_LABELS: Record<string, string> = {
  createdDesc: "Newest first",
  endingAsc: "Ending soon",
  hammerDesc: "Highest hammer",
  endedDesc: "Recently ended",
};

const LOT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
};

export function buildLotsActiveFilterChips(
  sp: SearchParams,
  ctx: {
    q?: string;
    artistId?: string;
    artistName?: string | null;
    saleId?: string;
    saleTitle?: string | null;
    categoryId?: string;
    categoryName?: string | null;
    sort?: string;
    status?: string;
    activeLens: string;
    lensOwnedSort?: boolean;
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const base = "/admin/lots";

  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref(base, sp, ["q"]),
    });
  }
  if (ctx.artistId?.trim()) {
    chips.push({
      id: "artistId",
      label: ctx.artistName
        ? `Artist: ${ctx.artistName}`
        : `Artist ID ${ctx.artistId.slice(0, 8)}…`,
      clearHref: omitParamsHref(base, sp, ["artistId"]),
    });
  }
  if (ctx.saleId?.trim()) {
    chips.push({
      id: "saleId",
      label: ctx.saleTitle ? `Sale: ${ctx.saleTitle}` : `Sale ID ${ctx.saleId.slice(0, 8)}…`,
      clearHref: omitParamsHref(base, sp, ["saleId"]),
    });
  }
  if (ctx.categoryId?.trim()) {
    chips.push({
      id: "categoryId",
      label: ctx.categoryName
        ? `Category: ${ctx.categoryName}`
        : `Category ID ${ctx.categoryId.slice(0, 8)}…`,
      clearHref: omitParamsHref(base, sp, ["categoryId"]),
    });
  }
  if (ctx.sort && isLotListSortKey(ctx.sort) && !ctx.lensOwnedSort) {
    chips.push({
      id: "sort",
      label: `Sort: ${LOT_SORT_LABELS[ctx.sort] ?? ctx.sort}`,
      clearHref: omitParamsHref(base, sp, ["sort"]),
    });
  }
  if (ctx.status && ctx.activeLens === "all") {
    chips.push({
      id: "status",
      label: `Status: ${LOT_STATUS_LABELS[ctx.status] ?? ctx.status}`,
      clearHref: omitParamsHref(base, sp, ["status"]),
    });
  }

  return chips;
}

export function buildSalesActiveFilterChips(
  sp: SearchParams,
  ctx: { q?: string; status?: string; deliveryMode?: string },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const base = "/admin/sales";

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
  if (ctx.deliveryMode?.trim()) {
    chips.push({
      id: "deliveryMode",
      label: `Delivery: ${ctx.deliveryMode}`,
      clearHref: omitParamsHref(base, sp, ["deliveryMode"]),
    });
  }

  return chips;
}

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

  return chips;
}

export function buildSubmissionsActiveFilterChips(
  sp: SearchParams,
  ctx: { q?: string; categoryId?: string; categoryName?: string | null },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const base = "/admin/submissions";

  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref(base, sp, ["q"]),
    });
  }
  if (ctx.categoryId?.trim()) {
    chips.push({
      id: "categoryId",
      label: ctx.categoryName ? `Category: ${ctx.categoryName}` : "Category filter",
      clearHref: omitParamsHref(base, sp, ["categoryId"]),
    });
  }

  return chips;
}

export function buildCategoriesActiveFilterChips(
  sp: SearchParams,
  ctx: { q?: string },
): CatalogActiveFilterChip[] {
  if (!ctx.q?.trim()) return [];
  return [
    {
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref("/admin/categories", sp, ["q"]),
    },
  ];
}

const CR_LENS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  declined: "Declined",
};

export function buildConditionReportsActiveFilterChips(
  sp: SearchParams,
  ctx: { activeLens: string },
): CatalogActiveFilterChip[] {
  if (ctx.activeLens === "open") return [];
  return [
    {
      id: "lens",
      label: `Lens: ${CR_LENS_LABELS[ctx.activeLens] ?? ctx.activeLens.replaceAll("_", " ")}`,
      clearHref: omitParamsHref("/admin/condition-reports", sp, ["lens"]),
    },
  ];
}

const FULFILMENT_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  awaiting_release: "Awaiting release",
  released: "Released",
  ready_for_collection: "Ready for collection",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function buildFulfilmentActiveFilterChips(
  sp: SearchParams,
  ctx: { status?: string },
): CatalogActiveFilterChip[] {
  if (!ctx.status?.trim()) return [];
  return [
    {
      id: "status",
      label: `Status: ${FULFILMENT_STATUS_LABELS[ctx.status] ?? ctx.status.replaceAll("_", " ")}`,
      clearHref: omitParamsHref("/admin/lot-fulfilment", sp, ["status"]),
    },
  ];
}
