import {
  type Lot,
  type LotStatus,
  type Sale,
  type SaleStatus,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";

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

export function isPublicCatalogSale(sale: Pick<Sale, "status">): boolean {
  return isPublicSaleStatus(sale.status);
}

/** Lot is public when its status is public and any parent sale is public. */
export function isPublicCatalogLot(
  lot: Pick<Lot, "status" | "saleId">,
  parentSale?: Pick<Sale, "status"> | null,
): boolean {
  if (!isPublicLotStatus(lot.status)) return false;
  if (lot.saleId && (!parentSale || !isPublicCatalogSale(parentSale))) return false;
  return true;
}

export function viewerCanSeeNonPublicCatalog(
  role: string | undefined,
  staffRole?: string | null,
): boolean {
  const r = normalizeUserRoleOrClient(role);
  const staff = normalizeUserStaffRole(staffRole ?? undefined);
  return (
    roleHasCapability(r, "auction.manage", staff) || roleHasCapability(r, "catalogue.write", staff)
  );
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
