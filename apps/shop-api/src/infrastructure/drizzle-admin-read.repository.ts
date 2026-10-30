import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopFulfilment,
  shopGuestCustomer,
  shopOrder,
  shopParty,
  shopPayoutLedger,
  shopProduct,
  shopProductVariant,
  shopSaleAuthorityRequest,
  shopStockHold,
  shopUserProfile,
} from "@auction/db/schema";
import { OPEN_EDITION_LOW_STOCK_AT, type OverviewKpiKey } from "@auction/shop-domain";
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  decodeCatalogueCursor,
  decodeNameCursor,
  encodeCatalogueCursor,
  encodeNameCursor,
  truncateCatalogueCursorDate,
} from "../application/catalogue-cursor.js";
import type { AdminOrderListFilters, AdminReadPorts } from "../application/ports/admin-readers.js";
import type { ShopApiEnv } from "../env.js";
import { notFound } from "../errors/shop-api-error.js";
import {
  keysetAfter,
  keysetBeforeCreatedAtId,
  orderByMsTimestampId,
  orderByMsTimestampIdDesc,
} from "./admin-created-at-keyset.js";
import { orderBuyer } from "./admin-order-buyer.js";
import { createDrizzleAdminArtworkReader } from "./drizzle-admin-artwork.reader.js";
import { createDrizzleAdminDetailReaders } from "./drizzle-admin-detail.repository.js";
import { createDrizzleAdminLookupReader } from "./drizzle-admin-lookup.reader.js";
import { createDrizzleAdminPeopleListsReader } from "./drizzle-admin-people-lists.reader.js";
import { createDrizzleAdminWorkListsReader } from "./drizzle-admin-work-lists.reader.js";
import { containsPattern } from "./drizzle-editorial-search.reader.js";
import { escapeLikePattern } from "./escape-like-pattern.js";
import { loadShopCancellationPolicy } from "./shop-cancellation-policy.js";
import { loadShopVatPolicy } from "./shop-vat-policy.js";

type OrderStatus = typeof shopOrder.$inferSelect.status;

/**
 * The filters that apply to the list and to the per-status counts alike (everything but status).
 * Search matches the start of the order id because staff quote the first eight characters as the
 * order number; names and emails match anywhere, with LIKE wildcards escaped.
 */
function orderFilterConditions(input: AdminOrderListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (input.createdFrom) {
    conditions.push(
      sql`${shopOrder.createdAt} >= (${input.createdFrom}::date)::timestamp AT TIME ZONE 'Europe/London'`,
    );
  }
  if (input.createdTo) {
    conditions.push(
      sql`${shopOrder.createdAt} < ((${input.createdTo}::date + 1))::timestamp AT TIME ZONE 'Europe/London'`,
    );
  }
  const q = input.q?.trim().replace(/^#/, "");
  if (q) {
    const contains = containsPattern(q);
    // Same escaping, without the leading wildcard.
    const idPrefix = contains.slice(1);
    const search = or(
      sql`${shopOrder.id}::text ILIKE ${idPrefix}`,
      sql`${shopOrder.reference} ILIKE ${contains}`,
      sql`${shopUserProfile.email} ILIKE ${contains}`,
      sql`${shopUserProfile.name} ILIKE ${contains}`,
      sql`${shopGuestCustomer.email} ILIKE ${contains}`,
      sql`${shopGuestCustomer.name} ILIKE ${contains}`,
      // The name kept on an erased guest's order is for the invoice only, never for finding them.
      sql`(${shopOrder.personalDataErasedAt} IS NULL AND ${shopOrder.deliveryRecipientName} ILIKE ${contains})`,
    );
    if (search) conditions.push(search);
  }
  return conditions;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function resolveLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function paginateByCreatedAtId<T extends { createdAt: Date; id: string }, R>(
  rows: T[],
  limit: number,
  mapRow: (row: T) => R,
): { items: R[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    items: page.map(mapRow),
    nextCursor:
      hasMore && last
        ? encodeCatalogueCursor({
            createdAt: truncateCatalogueCursorDate(last.createdAt),
            id: last.id,
          })
        : null,
  };
}

export function createDrizzleAdminReadRepository(
  db: Database,
  env?: Pick<
    ShopApiEnv,
    | "SHOP_CANCELLATION_DAYS_AFTER_POSSESSION"
    | "SHOP_PERSONALISED_GOODS_CANCELLATION_EXEMPT"
    | "SHOP_VAT_STANDARD_RATE_BP"
    | "SHOP_PAYOUTS_ENABLED"
    | "SHOP_MERCHANDISE_ENABLED"
    | "SHOP_ORIGINALS_ENABLED"
    | "SHOP_THIRD_PARTY_ENABLED"
  >,
  options: { resolveMediaUrl: (value: string | null | undefined) => string | null } = {
    resolveMediaUrl: (value) => value ?? null,
  },
): AdminReadPorts {
  const detail = createDrizzleAdminDetailReaders(db);
  const workLists = createDrizzleAdminWorkListsReader(db);
  const peopleLists = createDrizzleAdminPeopleListsReader(db);
  return {
    artworks: createDrizzleAdminArtworkReader(db, options),
    orders: {
      async listOrders(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const filters = orderFilterConditions(input);
        const listed = db
          .select({
            order: shopOrder,
            buyerName: shopUserProfile.name,
            buyerEmail: shopUserProfile.email,
            guestName: shopGuestCustomer.name,
            guestEmail: shopGuestCustomer.email,
          })
          .from(shopOrder)
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopOrder.identitySubjectId),
          )
          .leftJoin(shopGuestCustomer, eq(shopGuestCustomer.id, shopOrder.guestCustomerId));
        const [rows, countRows] = await Promise.all([
          listed
            .where(
              and(
                ...filters,
                input.status ? eq(shopOrder.status, input.status as OrderStatus) : undefined,
                cursor
                  ? keysetBeforeCreatedAtId(shopOrder.createdAt, shopOrder.id, cursor)
                  : undefined,
              ),
            )
            .orderBy(...orderByMsTimestampIdDesc(shopOrder.createdAt, shopOrder.id))
            .limit(limit + 1),
          db
            .select({ status: shopOrder.status, total: count() })
            .from(shopOrder)
            .leftJoin(
              shopUserProfile,
              eq(shopUserProfile.identitySubjectId, shopOrder.identitySubjectId),
            )
            .leftJoin(shopGuestCustomer, eq(shopGuestCustomer.id, shopOrder.guestCustomerId))
            .where(and(...filters))
            .groupBy(shopOrder.status),
        ]);
        const page = paginateByCreatedAtId(
          rows.map((row) => ({ ...row, id: row.order.id, createdAt: row.order.createdAt })),
          limit,
          ({ order, buyerName, buyerEmail, guestName, guestEmail }) => ({
            orderId: order.id,
            reference: order.reference,
            status: order.status,
            totalPence: order.totalPence,
            fulfilment: order.fulfilment,
            buyerSubjectId: order.identitySubjectId,
            ...orderBuyer(order.identitySubjectId, {
              buyerName,
              buyerEmail,
              guestName,
              guestEmail,
            }),
            createdAt: order.createdAt.toISOString(),
            paidAt: order.paidAt?.toISOString() ?? null,
          }),
        );
        return {
          ...page,
          counts: Object.fromEntries(countRows.map((row) => [row.status, row.total])),
        };
      },
      getOrderDetail: detail.getOrderDetail,
      async readOrderDailyTotals(since) {
        // UK days, as staff count them.
        const paidDay = sql<string>`to_char(${shopOrder.paidAt} AT TIME ZONE 'Europe/London', 'YYYY-MM-DD')`;
        const placedDay = sql<string>`to_char(${shopOrder.createdAt} AT TIME ZONE 'Europe/London', 'YYYY-MM-DD')`;
        const [paid, placed] = await Promise.all([
          db
            .select({
              day: paidDay,
              pence: sql<number>`coalesce(sum(${shopOrder.totalPence}), 0)::int`,
              orders: count(),
            })
            .from(shopOrder)
            .where(and(isNotNull(shopOrder.paidAt), gte(shopOrder.paidAt, since)))
            .groupBy(paidDay),
          db
            .select({ day: placedDay, orders: count() })
            .from(shopOrder)
            .where(gte(shopOrder.createdAt, since))
            .groupBy(placedDay),
        ]);
        return {
          paid: new Map(
            paid.map((row) => [row.day, { pence: Number(row.pence), orders: row.orders }]),
          ),
          placed: new Map(placed.map((row) => [row.day, row.orders])),
        };
      },
    },
    fulfilment: { listFulfilment: workLists.listFulfilment },
    payouts: { listPayouts: workLists.listPayouts },
    sales: {
      listStockHolds: workLists.listStockHolds,
      listThirdPartySales: workLists.listThirdPartySales,
      listOriginalSales: workLists.listOriginalSales,
    },
    parties: {
      listClientParties: peopleLists.listClientParties,
      async listArtists(input) {
        const limit = resolveLimit(input.limit);
        const sort = input.sort ?? "name_asc";
        const byName = sort === "name_asc" || sort === "name_desc";
        const direction = sort === "name_asc" || sort === "created_asc" ? "asc" : "desc";
        const cursor = byName ? null : decodeCatalogueCursor(input.cursor);
        const nameCursor = byName ? decodeNameCursor(input.cursor) : null;
        const q = input.q?.trim();
        const pattern = q ? containsPattern(q) : null;
        const search = pattern
          ? or(
              sql`${shopParty.displayName} ILIKE ${pattern}`,
              sql`${shopArtist.slug} ILIKE ${pattern}`,
            )
          : undefined;
        const nameAfter = nameCursor
          ? direction === "asc"
            ? or(
                gt(shopParty.displayName, nameCursor.name),
                and(eq(shopParty.displayName, nameCursor.name), gt(shopArtist.id, nameCursor.id)),
              )
            : or(
                lt(shopParty.displayName, nameCursor.name),
                and(eq(shopParty.displayName, nameCursor.name), lt(shopArtist.id, nameCursor.id)),
              )
          : undefined;
        const order = byName
          ? direction === "asc"
            ? [asc(shopParty.displayName), asc(shopArtist.id)]
            : [desc(shopParty.displayName), desc(shopArtist.id)]
          : [...orderByMsTimestampId(shopArtist.createdAt, shopArtist.id, direction)];
        const [rows, countRows] = await Promise.all([
          db
            .select({
              artist: shopArtist,
              displayName: shopParty.displayName,
              artworkCount: sql<number>`(
                select count(*)::int from ${shopArtwork} where ${shopArtwork.artistId} = ${shopArtist.id}
              )`,
            })
            .from(shopArtist)
            .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
            .where(
              and(
                search,
                input.status === "archived"
                  ? isNotNull(shopArtist.archivedAt)
                  : input.status === "active"
                    ? isNull(shopArtist.archivedAt)
                    : undefined,
                nameAfter,
                cursor
                  ? keysetAfter(shopArtist.createdAt, shopArtist.id, cursor, direction)
                  : undefined,
              ),
            )
            .orderBy(...order)
            .limit(limit + 1),
          db
            .select({
              active: sql<number>`count(*) filter (where ${shopArtist.archivedAt} is null)::int`,
              archived: sql<number>`count(*) filter (where ${shopArtist.archivedAt} is not null)::int`,
            })
            .from(shopArtist)
            .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
            .where(search),
        ]);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page.at(-1);
        return {
          items: page.map(({ artist, displayName, artworkCount }) => ({
            artistId: artist.id,
            slug: artist.slug,
            displayName,
            discipline: artist.discipline,
            createdAt: artist.createdAt.toISOString(),
            archived: artist.archivedAt !== null,
            artworkCount: Number(artworkCount),
          })),
          nextCursor:
            hasMore && last
              ? byName
                ? encodeNameCursor({ name: last.displayName, id: last.artist.id })
                : encodeCatalogueCursor({
                    createdAt: truncateCatalogueCursorDate(last.artist.createdAt),
                    id: last.artist.id,
                  })
              : null,
          counts: {
            active: Number(countRows[0]?.active ?? 0),
            archived: Number(countRows[0]?.archived ?? 0),
          },
        };
      },
      getClientDetail: detail.getClientDetail,
      getArtistDetail: detail.getArtistDetail,
    },
    saleAuthorityRequests: {
      listRequests: workLists.listRequests,
      async getRequestById(requestId: string) {
        const [row] = await db
          .select()
          .from(shopSaleAuthorityRequest)
          .where(eq(shopSaleAuthorityRequest.id, requestId))
          .limit(1);
        if (!row) {
          throw notFound("Sale authority request");
        }
        return {
          requestId: row.id,
          artworkId: row.artworkId,
          ownerPartyId: row.ownerPartyId,
          requestedCount: row.requestedCount,
          status: row.status,
        };
      },
    },
    staff: { listStaffMembers: peopleLists.listStaffMembers },
    catalogue: {
      async listMerchandiseProducts(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const search = input.q?.trim();
        const pattern = search ? `%${escapeLikePattern(search)}%` : null;
        // The search applies to the page and to the view counts alike; the status only to the page.
        const matchesSearch = pattern
          ? or(
              ilike(shopProduct.title, pattern),
              ilike(shopProduct.slug, pattern),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(shopProductVariant)
                  .where(
                    and(
                      eq(shopProductVariant.productId, shopProduct.id),
                      ilike(shopProductVariant.sku, pattern),
                    ),
                  ),
              ),
            )
          : undefined;
        const [countRow] = await db
          .select({
            active: sql<number>`(count(*) filter (where ${shopProduct.archivedAt} is null))::int`,
            archived: sql<number>`(count(*) filter (where ${shopProduct.archivedAt} is not null))::int`,
          })
          .from(shopProduct)
          .where(matchesSearch);
        const products = await db
          .select()
          .from(shopProduct)
          .where(
            and(
              input.status === "active" ? isNull(shopProduct.archivedAt) : undefined,
              input.status === "archived" ? isNotNull(shopProduct.archivedAt) : undefined,
              matchesSearch,
              cursor
                ? keysetBeforeCreatedAtId(shopProduct.createdAt, shopProduct.id, cursor)
                : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampIdDesc(shopProduct.createdAt, shopProduct.id))
          .limit(limit + 1);
        const hasMore = products.length > limit;
        const page = hasMore ? products.slice(0, limit) : products;
        const productIds = page.map((p) => p.id);
        const variants =
          productIds.length === 0
            ? []
            : await db
                .select()
                .from(shopProductVariant)
                .where(
                  and(
                    inArray(shopProductVariant.productId, productIds),
                    isNull(shopProductVariant.archivedAt),
                  ),
                );
        const byProduct = new Map<string, typeof variants>();
        for (const variant of variants) {
          const bucket = byProduct.get(variant.productId) ?? [];
          bucket.push(variant);
          byProduct.set(variant.productId, bucket);
        }
        const last = page.at(-1);
        return {
          items: page.map((product) => {
            const onSale = byProduct.get(product.id) ?? [];
            const prices = onSale.map((v) => v.pricePence);
            return {
              productId: product.id,
              slug: product.slug,
              title: product.title,
              status: product.archivedAt ? ("archived" as const) : ("active" as const),
              variantCount: onSale.length,
              fromPricePence: prices.length > 0 ? Math.min(...prices) : null,
              toPricePence: prices.length > 0 ? Math.max(...prices) : null,
              totalOnHand: onSale.reduce((sum, v) => sum + v.onHand, 0),
            };
          }),
          nextCursor:
            hasMore && last
              ? encodeCatalogueCursor({ createdAt: last.createdAt, id: last.id })
              : null,
          counts: { active: countRow?.active ?? 0, archived: countRow?.archived ?? 0 },
        };
      },

      async getMerchandiseProduct(productId) {
        const [product] = await db
          .select()
          .from(shopProduct)
          .where(eq(shopProduct.id, productId))
          .limit(1);
        if (!product) return null;
        const variants = await db
          .select()
          .from(shopProductVariant)
          .where(eq(shopProductVariant.productId, productId))
          .orderBy(asc(shopProductVariant.createdAt), asc(shopProductVariant.id));
        return {
          productId: product.id,
          slug: product.slug,
          title: product.title,
          description: product.description,
          status: product.archivedAt ? "archived" : "active",
          version: product.updatedAt.toISOString(),
          createdAt: product.createdAt.toISOString(),
          variants: variants.map((v) => ({
            variantId: v.id,
            sku: v.sku,
            pricePence: v.pricePence,
            onHand: v.onHand,
            reserved: v.reserved,
            status: v.archivedAt ? ("archived" as const) : ("active" as const),
          })),
        };
      },
    },
    overview: {
      async readOverviewKpis(keys) {
        const count = async (query: PromiseLike<Array<{ count: number }>>) =>
          (await query)[0]?.count ?? 0;
        const counters: Record<OverviewKpiKey, () => Promise<number>> = {
          fulfilmentOpenCount: () =>
            count(
              db
                .select({ count: sql<number>`count(*)::int` })
                .from(shopFulfilment)
                .where(
                  inArray(shopFulfilment.status, [
                    "pending_production",
                    "in_production",
                    "awaiting_dispatch",
                  ]),
                ),
            ),
          payoutsDueCount: () =>
            count(
              db
                .select({ count: sql<number>`count(*)::int` })
                .from(shopPayoutLedger)
                .where(eq(shopPayoutLedger.status, "due")),
            ),
          activeHoldsCount: () =>
            count(
              db
                .select({ count: sql<number>`count(*)::int` })
                .from(shopStockHold)
                .where(eq(shopStockHold.status, "active")),
            ),
          pendingAuthorityRequestsCount: () =>
            count(
              db
                .select({ count: sql<number>`count(*)::int` })
                .from(shopSaleAuthorityRequest)
                .where(eq(shopSaleAuthorityRequest.status, "pending")),
            ),
        };
        const entries = await Promise.all(
          keys.map(async (key) => [key, await counters[key]()] as const),
        );
        return Object.fromEntries(entries);
      },

      async listLowStockRuns() {
        // Written qualified: the correlated count reads the outer artwork row.
        const onSale = sql<number>`(
          select count(*)::int from "shop_edition" e
          where e."artwork_id" = "shop_artwork"."id" and e."listing_status" = 'authorised'
        )`;
        const rows = await db
          .select({ artworkId: shopArtwork.id, title: shopArtwork.title, onSale })
          .from(shopArtwork)
          .where(
            and(
              eq(shopArtwork.runKind, "open"),
              isNotNull(shopArtwork.publishedAt),
              isNull(shopArtwork.archivedAt),
              sql`${onSale} <= ${OPEN_EDITION_LOW_STOCK_AT}`,
            ),
          )
          .orderBy(asc(onSale), asc(shopArtwork.title))
          .limit(20);
        return rows.map((row) => ({ ...row, onSale: Number(row.onSale) }));
      },
    },
    lookups: createDrizzleAdminLookupReader(db),
    compliance: {
      listAuditEntries: peopleLists.listAuditEntries,
      readAuditFacets: peopleLists.readAuditFacets,
      listDisputes: workLists.listDisputes,
      async readEffectiveSettings() {
        const cancellation = env ? loadShopCancellationPolicy(env as ShopApiEnv) : null;
        const vat = env ? loadShopVatPolicy(env as ShopApiEnv) : null;
        return {
          cancellationDaysAfterPossession: cancellation?.daysAfterPossession ?? null,
          personalisedGoodsCancellationExempt: cancellation?.personalisedGoodsExempt ?? false,
          vatStandardRateBp: vat?.standardRateBp ?? null,
          payoutsEnabled: env?.SHOP_PAYOUTS_ENABLED ?? false,
          merchandiseEnabled: env?.SHOP_MERCHANDISE_ENABLED ?? false,
          originalsEnabled: env?.SHOP_ORIGINALS_ENABLED ?? false,
          thirdPartyEnabled: env?.SHOP_THIRD_PARTY_ENABLED ?? false,
        };
      },
    },
  };
}
