import {
  type AtgDistribution,
  type AtgOwnershipState,
  CATALOGUE_READ_ACCESS,
  type Lot,
  type LotStatus,
  NO_STAFF_ROLES,
  type Sale,
  type SaleStatus,
  type StaffRoles,
  normalizeUserRoleOrClient,
  userHasAccessTo,
} from "@auction/types";

export type PublicCatalogSaleContext = Pick<Sale, "status"> & {
  sellingPlatform?: AtgOwnershipState | null;
  atgDistribution?: AtgDistribution | null;
};

/** Browse surfaces: home strips, search default, new lots — not archive. */
export const PUBLIC_BROWSE_LOT_STATUSES = [
  "scheduled",
  "active",
] as const satisfies readonly LotStatus[];
export const PUBLIC_BROWSE_SALE_STATUSES = [
  "scheduled",
  "active",
] as const satisfies readonly SaleStatus[];

/** Detail pages, sitemap, archive. */
export const PUBLIC_LOT_STATUSES = [
  "scheduled",
  "active",
  "ended",
] as const satisfies readonly LotStatus[];
export const PUBLIC_SALE_STATUSES = [
  "scheduled",
  "active",
  "ended",
] as const satisfies readonly SaleStatus[];

const NON_PUBLIC_LOT_STATUSES: readonly LotStatus[] = ["draft", "cancelled", "voided"];
const NON_PUBLIC_SALE_STATUSES: readonly SaleStatus[] = ["draft", "cancelled"];

export type PublicLotListFilter = {
  status?: LotStatus;
  statuses?: LotStatus[];
};

export type PublicSaleListFilter = {
  status?: SaleStatus;
  statuses?: SaleStatus[];
};

export function isPublicLotStatus(status: LotStatus): boolean {
  return (PUBLIC_LOT_STATUSES as readonly LotStatus[]).includes(status);
}

export function isPublicSaleStatus(status: SaleStatus): boolean {
  return (PUBLIC_SALE_STATUSES as readonly SaleStatus[]).includes(status);
}

/** Draft LAX sales that ATG owns stay readable on lax.bid (read-only) while they sell on ATG. */
/**
 * An ATG-owned draft is public only when ATG lists it publicly. A `private_test` auction is
 * hidden from ATG's own listings and stays off the public catalogue too.
 */
export function isAtgOwnedCatalogSale(sale: PublicCatalogSaleContext): boolean {
  return (
    sale.status === "draft" &&
    sale.sellingPlatform === "atg" &&
    sale.atgDistribution === "public_marketplace"
  );
}

export function isPublicCatalogSale(sale: PublicCatalogSaleContext): boolean {
  return isPublicSaleStatus(sale.status) || isAtgOwnedCatalogSale(sale);
}

/** Lot is public when its status is public and any parent sale is public. */
export function isPublicCatalogLot(
  lot: Pick<Lot, "status" | "saleId">,
  parentSale?: PublicCatalogSaleContext | null,
): boolean {
  if (lot.status === "cancelled" || lot.status === "voided") return false;
  if (lot.status === "draft") {
    return Boolean(lot.saleId && parentSale && isAtgOwnedCatalogSale(parentSale));
  }
  if (!isPublicLotStatus(lot.status)) return false;
  if (lot.saleId && (!parentSale || !isPublicCatalogSale(parentSale))) return false;
  return true;
}

export function viewerCanSeeNonPublicCatalog(
  role: string | undefined,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): boolean {
  return userHasAccessTo(normalizeUserRoleOrClient(role), staffRoles, CATALOGUE_READ_ACCESS);
}

/** Maps explicit status query + viewer into repository list filters. */
export function resolvePublicLotListFilter(input: {
  status?: LotStatus | undefined;
  statuses?: LotStatus[] | undefined;
  viewerCanSeeNonPublic: boolean;
}): PublicLotListFilter {
  if (input.viewerCanSeeNonPublic) {
    if (input.statuses?.length) return { statuses: input.statuses };
    if (input.status) return { status: input.status };
    return {};
  }
  if (input.statuses?.length) {
    const allowed = input.statuses.filter((s) => !NON_PUBLIC_LOT_STATUSES.includes(s));
    if (allowed.length === 0) return { statuses: [] };
    return { statuses: allowed };
  }
  if (input.status && NON_PUBLIC_LOT_STATUSES.includes(input.status)) {
    return { statuses: [] };
  }
  if (input.status) {
    return { status: input.status };
  }
  return { statuses: [...PUBLIC_BROWSE_LOT_STATUSES] };
}

export function resolvePublicSaleListFilter(input: {
  status?: SaleStatus | undefined;
  statuses?: SaleStatus[] | undefined;
  viewerCanSeeNonPublic: boolean;
}): PublicSaleListFilter {
  if (input.viewerCanSeeNonPublic) {
    if (input.statuses?.length) return { statuses: input.statuses };
    if (input.status) return { status: input.status };
    return {};
  }
  if (input.statuses?.length) {
    const allowed = input.statuses.filter((s) => !NON_PUBLIC_SALE_STATUSES.includes(s));
    if (allowed.length === 0) return { statuses: [] };
    return { statuses: allowed };
  }
  if (input.status) {
    if (NON_PUBLIC_SALE_STATUSES.includes(input.status)) return { statuses: [] };
    return { status: input.status };
  }
  return { statuses: [...PUBLIC_BROWSE_SALE_STATUSES] };
}

export function filterLotsForPublicCatalog(
  lots: Lot[],
  salesById: ReadonlyMap<string, Sale>,
): Lot[] {
  return lots.filter((lot) => {
    const parent = lot.saleId ? (salesById.get(lot.saleId) ?? null) : null;
    return isPublicCatalogLot(lot, parent);
  });
}
