import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { isLotListSortKey } from "@/lib/admin/lots-list-sort";
import type { UsersListFilters } from "@/lib/admin/users-list-query";

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
  ctx: {
    q?: string;
    status?: string;
    deliveryMode?: string;
    lifecycle?: string;
    sort?: string;
    activeLensId?: string;
    lensOwnedLifecycle?: boolean;
    setupLens?: boolean;
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const base = "/admin/sales";

  const SALE_STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    active: "Live",
    closed: "Closed",
    cancelled: "Cancelled",
  };

  const LIFECYCLE_LABELS: Record<string, string> = {
    upcoming: "Upcoming",
    live: "Live",
    closed: "Closed",
    settled: "Settled",
  };

  const DELIVERY_LABELS: Record<string, string> = {
    online: "Online",
    onsite: "On-site",
  };

  const SALE_SORT_LABELS: Record<string, string> = {
    createdDesc: "Newest first",
    startAsc: "Starting soonest",
  };

  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref(base, sp, ["q"]),
    });
  }
  if (ctx.setupLens) {
    chips.push({
      id: "lens",
      label: "Lens: Needs setup",
      clearHref: omitParamsHref(base, sp, ["lens", "needsSetup", "status"]),
    });
  } else if (ctx.lifecycle?.trim() && ctx.activeLensId === "all") {
    chips.push({
      id: "lifecycle",
      label: `Lifecycle: ${LIFECYCLE_LABELS[ctx.lifecycle] ?? ctx.lifecycle}`,
      clearHref: omitParamsHref(base, sp, ["lifecycle", "lens"]),
    });
  }
  if (ctx.status?.trim() && !ctx.setupLens) {
    chips.push({
      id: "status",
      label: `Status: ${SALE_STATUS_LABELS[ctx.status] ?? ctx.status}`,
      clearHref: omitParamsHref(base, sp, ["status"]),
    });
  }
  if (ctx.deliveryMode?.trim()) {
    chips.push({
      id: "deliveryMode",
      label: `Delivery: ${DELIVERY_LABELS[ctx.deliveryMode] ?? ctx.deliveryMode}`,
      clearHref: omitParamsHref(base, sp, ["delivery"]),
    });
  }
  if (ctx.sort && !ctx.lensOwnedLifecycle) {
    chips.push({
      id: "sort",
      label: `Sort: ${SALE_SORT_LABELS[ctx.sort] ?? ctx.sort}`,
      clearHref: omitParamsHref(base, sp, ["sort"]),
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

export function buildSubmissionsActiveFilterChips(
  sp: SearchParams,
  ctx: {
    q?: string;
    categoryId?: string;
    categoryName?: string | null;
    qualityGaps?: boolean;
    assignedToMe?: boolean;
    sort?: "sla";
  },
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
      label: ctx.categoryName
        ? `Category: ${ctx.categoryName}`
        : `Category ID ${ctx.categoryId.slice(0, 8)}…`,
      clearHref: omitParamsHref(base, sp, ["categoryId"]),
    });
  }
  if (ctx.assignedToMe) {
    chips.push({
      id: "assignedTo",
      label: "My queue",
      clearHref: omitParamsHref(base, sp, ["assignedTo"]),
    });
  }
  if (ctx.sort === "sla") {
    chips.push({
      id: "sort",
      label: "Sort: SLA (oldest first)",
      clearHref: omitParamsHref(base, sp, ["sort"]),
    });
  }
  if (ctx.qualityGaps) {
    chips.push({
      id: "qualityGaps",
      label: "Quality gaps only",
      clearHref: omitParamsHref(base, sp, ["qualityGaps"]),
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

export function buildVenuesActiveFilterChips(
  sp: SearchParams,
  ctx: {
    q?: string;
    includeArchived?: boolean;
    legalEntityId?: string;
    legalEntityName?: string | null;
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref("/admin/venues", sp, ["q"]),
    });
  }
  if (ctx.legalEntityId?.trim()) {
    chips.push({
      id: "legalEntityId",
      label: ctx.legalEntityName
        ? `Org: ${ctx.legalEntityName}`
        : `Org ID ${ctx.legalEntityId.slice(0, 8)}…`,
      clearHref: omitParamsHref("/admin/venues", sp, ["legalEntityId"]),
    });
  }
  if (ctx.includeArchived) {
    chips.push({
      id: "includeArchived",
      label: "Include archived",
      clearHref: omitParamsHref("/admin/venues", sp, ["includeArchived"]),
    });
  }
  return chips;
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

export const FULFILMENT_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  awaiting_release: "Awaiting release",
  released: "Released",
  ready_for_collection: "Ready for collection",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const USER_SORT_LABELS: Record<string, string> = {
  created_desc: "Newest first",
  created_asc: "Oldest first",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
  last_active_desc: "Last active",
  kyc_status: "KYC status",
};

const KYC_STATUS_LABELS: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function buildUsersActiveFilterChips(
  basePath: string,
  sp: SearchParams,
  filters: UsersListFilters,
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];

  if (filters.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${filters.q.trim()}`,
      clearHref: omitParamsHref(basePath, sp, ["q"]),
    });
  }
  if (filters.accountStatus) {
    chips.push({
      id: "status",
      label: `Status: ${filters.accountStatus}`,
      clearHref: omitParamsHref(basePath, sp, ["status", "suspended"]),
    });
  } else if (filters.suspendedOnly) {
    chips.push({
      id: "suspended",
      label: "Suspended only",
      clearHref: omitParamsHref(basePath, sp, ["suspended"]),
    });
  }
  if (filters.emailVerified === true) {
    chips.push({
      id: "emailVerified",
      label: "Email verified",
      clearHref: omitParamsHref(basePath, sp, ["emailVerified"]),
    });
  } else if (filters.emailVerified === false) {
    chips.push({
      id: "emailVerified",
      label: "Email unverified",
      clearHref: omitParamsHref(basePath, sp, ["emailVerified"]),
    });
  }
  if (filters.kycStatuses?.length) {
    chips.push({
      id: "kycStatuses",
      label: `KYC: ${filters.kycStatuses.map((s) => KYC_STATUS_LABELS[s] ?? s).join(", ")}`,
      clearHref: omitParamsHref(basePath, sp, ["kycStatuses", "kycStatus"]),
    });
  } else if (filters.kycStatus) {
    chips.push({
      id: "kycStatus",
      label: `KYC: ${KYC_STATUS_LABELS[filters.kycStatus] ?? filters.kycStatus}`,
      clearHref: omitParamsHref(basePath, sp, ["kycStatus", "kycStatuses"]),
    });
  }
  if (filters.persona) {
    chips.push({
      id: "persona",
      label: `Persona: ${filters.persona === "none" ? "Not set" : filters.persona}`,
      clearHref: omitParamsHref(basePath, sp, ["persona"]),
    });
  }
  if (filters.twoFactorEnabled === true) {
    chips.push({
      id: "twoFactor",
      label: "2FA enabled",
      clearHref: omitParamsHref(basePath, sp, ["twoFactor"]),
    });
  } else if (filters.twoFactorEnabled === false) {
    chips.push({
      id: "twoFactor",
      label: "2FA off",
      clearHref: omitParamsHref(basePath, sp, ["twoFactor"]),
    });
  }
  if (filters.deletionRequestedOnly) {
    chips.push({
      id: "deletionRequested",
      label: "Deletion requested",
      clearHref: omitParamsHref(basePath, sp, ["deletionRequested"]),
    });
  }
  if (filters.hasMobile === true) {
    chips.push({
      id: "hasMobile",
      label: "Has mobile",
      clearHref: omitParamsHref(basePath, sp, ["hasMobile"]),
    });
  } else if (filters.hasMobile === false) {
    chips.push({
      id: "hasMobile",
      label: "No mobile",
      clearHref: omitParamsHref(basePath, sp, ["hasMobile"]),
    });
  }
  if (filters.createdFrom || filters.createdTo) {
    chips.push({
      id: "created",
      label: `Joined: ${filters.createdFrom ?? "…"} – ${filters.createdTo ?? "…"}`,
      clearHref: omitParamsHref(basePath, sp, ["createdFrom", "createdTo"]),
    });
  }
  if (filters.kycVerifiedFrom || filters.kycVerifiedTo) {
    chips.push({
      id: "kycVerified",
      label: `KYC verified: ${filters.kycVerifiedFrom ?? "…"} – ${filters.kycVerifiedTo ?? "…"}`,
      clearHref: omitParamsHref(basePath, sp, ["kycVerifiedFrom", "kycVerifiedTo"]),
    });
  }
  if (filters.lastActiveFrom || filters.lastActiveTo) {
    chips.push({
      id: "lastActive",
      label: `Last active: ${filters.lastActiveFrom ?? "…"} – ${filters.lastActiveTo ?? "…"}`,
      clearHref: omitParamsHref(basePath, sp, ["lastActiveFrom", "lastActiveTo"]),
    });
  }
  if (filters.sort && filters.sort !== "created_desc") {
    chips.push({
      id: "sort",
      label: `Sort: ${USER_SORT_LABELS[filters.sort] ?? filters.sort}`,
      clearHref: omitParamsHref(basePath, sp, ["sort"]),
    });
  }

  return chips;
}

export function buildFulfilmentActiveFilterChips(
  sp: SearchParams,
  ctx: { status?: string; q?: string },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref("/admin/lot-fulfilment", sp, ["q"]),
    });
  }
  if (ctx.status?.trim()) {
    chips.push({
      id: "status",
      label: `Status: ${FULFILMENT_STATUS_LABELS[ctx.status] ?? ctx.status.replaceAll("_", " ")}`,
      clearHref: omitParamsHref("/admin/lot-fulfilment", sp, ["status"]),
    });
  }
  return chips;
}
