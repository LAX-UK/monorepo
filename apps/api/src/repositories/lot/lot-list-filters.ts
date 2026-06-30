import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { lot, lotCategories, sale } from "@auction/db/schema";
import type { SaleStatus } from "@auction/types";
import { PUBLIC_SALE_STATUSES } from "@auction/validators";
import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, lte, sql } from "drizzle-orm";
import type {
  ListCatalogLotsBySalePageInput,
  ListLotsFilter,
  ListLotsSort,
  SaleCatalogLotsSort,
} from "../../services/interfaces/repositories.js";

export type ListWhereInput = Omit<ListLotsFilter, "limit" | "offset" | "sort">;

export function endYearBoundsUtc(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export function publicParentSaleExists() {
  return sql`(
    ${lot.saleId} IS NULL
    OR EXISTS (
      SELECT 1 FROM ${sale} AS parent_sale
      WHERE parent_sale.id = ${lot.saleId}
        AND parent_sale.deleted_at IS NULL
        AND parent_sale.status IN (${sql.join(
          PUBLIC_SALE_STATUSES.map((status) => sql`${status}`),
          sql`, `,
        )})
    )
  )`;
}

export function listWhere(input: ListWhereInput) {
  const conditions = [lotNotDeleted()];
  if (input.statuses !== undefined) {
    if (input.statuses.length === 0) {
      conditions.push(sql`false`);
    } else {
      conditions.push(inArray(lot.status, input.statuses));
    }
  } else if (input.status) {
    conditions.push(eq(lot.status, input.status));
  }
  const categoryIds = input.categoryIds?.length
    ? input.categoryIds
    : input.categoryId
      ? [input.categoryId]
      : [];
  if (categoryIds.length > 0) {
    conditions.push(sql`exists (
      select 1 from ${lotCategories}
      where ${lotCategories.lotId} = ${lot.id}
        and ${lotCategories.categoryId} in (${sql.join(
          categoryIds.map((categoryId) => sql`${categoryId}`),
          sql`, `,
        )})
    )`);
  }
  if (input.sellerLegalEntityId)
    conditions.push(eq(lot.sellerLegalEntityId, input.sellerLegalEntityId));
  if (input.winnerId) conditions.push(eq(lot.winnerId, input.winnerId));
  if (input.saleId) conditions.push(eq(lot.saleId, input.saleId));
  if (input.artistId) conditions.push(eq(lot.artistId, input.artistId));
  if (input.endYear !== undefined) {
    const { start, end } = endYearBoundsUtc(input.endYear);
    conditions.push(gte(lot.endTime, start));
    conditions.push(lt(lot.endTime, end));
  }
  if (input.endingWithinHours !== undefined && input.endingWithinHours > 0) {
    const now = new Date();
    const endBefore = new Date(now.getTime() + input.endingWithinHours * 60 * 60 * 1000);
    conditions.push(eq(lot.status, "active"));
    conditions.push(gt(lot.endTime, now));
    conditions.push(lte(lot.endTime, endBefore));
  }
  if (input.search?.trim()) {
    const safe = input.search
      .trim()
      .slice(0, 200)
      .replace(/[%_\\]/g, "");
    if (safe.length >= 3) {
      conditions.push(ilike(lot.title, `%${safe}%`));
    } else if (safe.length > 0) {
      conditions.push(sql`false`);
    }
  }
  if (input.needsPhotos) {
    conditions.push(sql`cardinality(${lot.images}) = 0`);
  }
  if (input.requirePublicParentSale) {
    conditions.push(publicParentSaleExists());
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function catalogSalePageOrderBy(sort: SaleCatalogLotsSort) {
  switch (sort) {
    case "priceAsc":
      return asc(lot.currentPrice);
    case "priceDesc":
      return desc(lot.currentPrice);
    case "endingAsc":
      return asc(lot.endTime);
    default:
      return asc(sql`coalesce(${lot.lotNumber}, 999999)`);
  }
}

export function catalogLotsBySaleWhere(
  input: Omit<ListCatalogLotsBySalePageInput, "sort" | "limit" | "offset">,
) {
  const conditions = [eq(lot.saleId, input.saleId), lotNotDeleted()];
  if (input.lotStatuses !== undefined) {
    if (input.lotStatuses.length === 0) {
      conditions.push(sql`false`);
    } else {
      conditions.push(inArray(lot.status, input.lotStatuses));
    }
  }
  if (input.requirePublicSale) {
    conditions.push(eq(sale.id, lot.saleId), saleNotDeleted());
    conditions.push(inArray(sale.status, [...PUBLIC_SALE_STATUSES] as SaleStatus[]));
  }
  return and(...conditions);
}

export function listOrderBy(sort: ListLotsSort | undefined) {
  switch (sort) {
    case "endingAsc":
      return asc(lot.endTime);
    case "hammerDesc":
      return desc(lot.currentPrice);
    case "endedDesc":
      return desc(lot.endTime);
    default:
      return desc(lot.createdAt);
  }
}
