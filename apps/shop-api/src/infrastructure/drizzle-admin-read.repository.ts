import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopClientAssignment,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOriginalSale,
  shopParty,
  shopPayoutLedger,
  shopProduct,
  shopProductVariant,
  shopProductionTask,
  shopSaleAuthorityRequest,
  shopStaffMember,
  shopStockHold,
  shopThirdPartySale,
} from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  truncateCatalogueCursorDate,
} from "../application/catalogue-cursor.js";
import type { AdminReadPorts } from "../application/ports/admin-readers.js";
import { notFound } from "../errors/shop-api-error.js";
import { keysetBeforeCreatedAtId, orderByMsTimestampIdDesc } from "./admin-created-at-keyset.js";
import { createDrizzleAdminDetailReaders } from "./drizzle-admin-detail.repository.js";

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

export function createDrizzleAdminReadRepository(db: Database): AdminReadPorts {
  const detail = createDrizzleAdminDetailReaders(db);
  return {
    orders: {
      async listOrders(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select()
          .from(shopOrder)
          .where(
            cursor ? keysetBeforeCreatedAtId(shopOrder.createdAt, shopOrder.id, cursor) : undefined,
          )
          .orderBy(...orderByMsTimestampIdDesc(shopOrder.createdAt, shopOrder.id))
          .limit(limit + 1);
        return paginateByCreatedAtId(
          rows.map((row) => ({ ...row, id: row.id })),
          limit,
          (row) => ({
            orderId: row.id,
            status: row.status,
            totalPence: row.totalPence,
            fulfilment: row.fulfilment,
            buyerSubjectId: row.identitySubjectId,
            createdAt: row.createdAt.toISOString(),
            paidAt: row.paidAt?.toISOString() ?? null,
          }),
        );
      },
      getOrderDetail: detail.getOrderDetail,
    },
    fulfilment: {
      async listFulfilment(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select()
          .from(shopFulfilment)
          .where(
            cursor
              ? keysetBeforeCreatedAtId(shopFulfilment.updatedAt, shopFulfilment.id, cursor)
              : undefined,
          )
          .orderBy(...orderByMsTimestampIdDesc(shopFulfilment.updatedAt, shopFulfilment.id))
          .limit(limit + 1);
        return paginateByCreatedAtId(
          rows.map((row) => ({ createdAt: row.updatedAt, id: row.id, row })),
          limit,
          ({ row }) => ({
            fulfilmentId: row.id,
            orderId: row.orderId,
            status: row.status,
            option: row.option,
            carrier: row.carrier,
            trackingNumber: row.trackingNumber,
            updatedAt: row.updatedAt.toISOString(),
          }),
        );
      },
    },
    production: {
      async listProductionTasks(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select()
          .from(shopProductionTask)
          .where(
            cursor
              ? keysetBeforeCreatedAtId(shopProductionTask.createdAt, shopProductionTask.id, cursor)
              : undefined,
          )
          .orderBy(...orderByMsTimestampIdDesc(shopProductionTask.createdAt, shopProductionTask.id))
          .limit(limit + 1);
        return paginateByCreatedAtId(rows, limit, (row) => ({
          taskId: row.id,
          orderLineId: row.orderLineId,
          editionId: row.editionId,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        }));
      },
    },
    payouts: {
      async listPayouts(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select({
            payout: shopPayoutLedger,
            ownerDisplayName: shopParty.displayName,
          })
          .from(shopPayoutLedger)
          .innerJoin(shopParty, eq(shopPayoutLedger.ownerPartyId, shopParty.id))
          .where(
            cursor
              ? keysetBeforeCreatedAtId(shopPayoutLedger.createdAt, shopPayoutLedger.id, cursor)
              : undefined,
          )
          .orderBy(...orderByMsTimestampIdDesc(shopPayoutLedger.createdAt, shopPayoutLedger.id))
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page.at(-1);
        return {
          items: page.map(({ payout, ownerDisplayName }) => ({
            payoutId: payout.id,
            ownerPartyId: payout.ownerPartyId,
            ownerDisplayName,
            source: payout.source,
            grossPence: payout.grossPence,
            deductionsPence: payout.deductionsPence,
            netPence: payout.netPence,
            status: payout.status,
            payoutDueAt: payout.payoutDueAt.toISOString(),
            paidAt: payout.paidAt?.toISOString() ?? null,
          })),
          nextCursor:
            hasMore && last
              ? encodeCatalogueCursor({
                  createdAt: truncateCatalogueCursorDate(last.payout.createdAt),
                  id: last.payout.id,
                })
              : null,
        };
      },
    },
    sales: {
      async listStockHolds(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const brokerSubjectId = input.brokerSubjectId?.trim();
        const baseQuery = db
          .select({
            hold: shopStockHold,
            artworkTitle: shopArtwork.title,
            editionNumber: shopEdition.editionNumber,
          })
          .from(shopStockHold)
          .innerJoin(shopEdition, eq(shopStockHold.editionId, shopEdition.id))
          .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id));

        const rows = await (brokerSubjectId
          ? baseQuery
              .innerJoin(
                shopClientAssignment,
                eq(shopStockHold.clientPartyId, shopClientAssignment.clientPartyId),
              )
              .where(
                and(
                  eq(shopClientAssignment.brokerSubjectId, brokerSubjectId),
                  cursor
                    ? keysetBeforeCreatedAtId(shopStockHold.createdAt, shopStockHold.id, cursor)
                    : undefined,
                ),
              )
          : baseQuery.where(
              cursor
                ? keysetBeforeCreatedAtId(shopStockHold.createdAt, shopStockHold.id, cursor)
                : undefined,
            )
        )
          .orderBy(...orderByMsTimestampIdDesc(shopStockHold.createdAt, shopStockHold.id))
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page.at(-1);
        return {
          items: page.map(({ hold, artworkTitle, editionNumber }) => ({
            holdId: hold.id,
            editionId: hold.editionId,
            artworkTitle,
            editionNumber,
            status: hold.status,
            expiresAt: hold.expiresAt.toISOString(),
            brokerPartyId: hold.brokerPartyId,
            clientPartyId: hold.clientPartyId,
          })),
          nextCursor:
            hasMore && last
              ? encodeCatalogueCursor({
                  createdAt: truncateCatalogueCursorDate(last.hold.createdAt),
                  id: last.hold.id,
                })
              : null,
        };
      },
      async listThirdPartySales(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select({
            sale: shopThirdPartySale,
            artworkTitle: shopArtwork.title,
            editionNumber: shopEdition.editionNumber,
          })
          .from(shopThirdPartySale)
          .innerJoin(shopEdition, eq(shopThirdPartySale.editionId, shopEdition.id))
          .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
          .where(
            cursor
              ? keysetBeforeCreatedAtId(shopThirdPartySale.createdAt, shopThirdPartySale.id, cursor)
              : undefined,
          )
          .orderBy(...orderByMsTimestampIdDesc(shopThirdPartySale.createdAt, shopThirdPartySale.id))
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page.at(-1);
        return {
          items: page.map(({ sale, artworkTitle, editionNumber }) => ({
            saleId: sale.id,
            editionId: sale.editionId,
            artworkTitle,
            editionNumber,
            status: sale.status,
            grossPence: sale.grossPence,
            recordedAt: sale.recordedAt?.toISOString() ?? null,
          })),
          nextCursor:
            hasMore && last
              ? encodeCatalogueCursor({
                  createdAt: truncateCatalogueCursorDate(last.sale.createdAt),
                  id: last.sale.id,
                })
              : null,
        };
      },
      async listOriginalSales(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select({
            sale: shopOriginalSale,
            artworkTitle: shopArtwork.title,
          })
          .from(shopOriginalSale)
          .innerJoin(shopArtwork, eq(shopOriginalSale.artworkId, shopArtwork.id))
          .where(
            cursor
              ? keysetBeforeCreatedAtId(shopOriginalSale.createdAt, shopOriginalSale.id, cursor)
              : undefined,
          )
          .orderBy(...orderByMsTimestampIdDesc(shopOriginalSale.createdAt, shopOriginalSale.id))
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page.at(-1);
        return {
          items: page.map(({ sale, artworkTitle }) => ({
            saleId: sale.id,
            artworkId: sale.artworkId,
            artworkTitle,
            status: sale.status,
            salePricePence: sale.salePricePence,
            createdAt: sale.createdAt.toISOString(),
          })),
          nextCursor:
            hasMore && last
              ? encodeCatalogueCursor({
                  createdAt: truncateCatalogueCursorDate(last.sale.createdAt),
                  id: last.sale.id,
                })
              : null,
        };
      },
    },
    parties: {
      async listClientParties(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select()
          .from(shopParty)
          .where(
            and(
              inArray(shopParty.kind, ["person", "gallery"]),
              cursor
                ? keysetBeforeCreatedAtId(shopParty.createdAt, shopParty.id, cursor)
                : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampIdDesc(shopParty.createdAt, shopParty.id))
          .limit(limit + 1);
        return paginateByCreatedAtId(rows, limit, (row) => ({
          partyId: row.id,
          displayName: row.displayName,
          kind: row.kind,
          identitySubjectId: row.identitySubjectId,
          createdAt: row.createdAt.toISOString(),
        }));
      },
      async listArtists(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select({
            artist: shopArtist,
            displayName: shopParty.displayName,
          })
          .from(shopArtist)
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .where(
            cursor
              ? keysetBeforeCreatedAtId(shopArtist.createdAt, shopArtist.id, cursor)
              : undefined,
          )
          .orderBy(...orderByMsTimestampIdDesc(shopArtist.createdAt, shopArtist.id))
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page.at(-1);
        return {
          items: page.map(({ artist, displayName }) => ({
            artistId: artist.id,
            slug: artist.slug,
            displayName,
            discipline: artist.discipline,
            createdAt: artist.createdAt.toISOString(),
          })),
          nextCursor:
            hasMore && last
              ? encodeCatalogueCursor({
                  createdAt: truncateCatalogueCursorDate(last.artist.createdAt),
                  id: last.artist.id,
                })
              : null,
        };
      },
      getClientDetail: detail.getClientDetail,
      getArtistDetail: detail.getArtistDetail,
    },
    saleAuthorityRequests: {
      async listRequests(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select({
            request: shopSaleAuthorityRequest,
            artworkTitle: shopArtwork.title,
            ownerDisplayName: shopParty.displayName,
          })
          .from(shopSaleAuthorityRequest)
          .innerJoin(shopArtwork, eq(shopSaleAuthorityRequest.artworkId, shopArtwork.id))
          .innerJoin(shopParty, eq(shopSaleAuthorityRequest.ownerPartyId, shopParty.id))
          .where(
            and(
              input.status
                ? eq(
                    shopSaleAuthorityRequest.status,
                    input.status as (typeof shopSaleAuthorityRequest.status.enumValues)[number],
                  )
                : undefined,
              cursor
                ? keysetBeforeCreatedAtId(
                    shopSaleAuthorityRequest.createdAt,
                    shopSaleAuthorityRequest.id,
                    cursor,
                  )
                : undefined,
            ),
          )
          .orderBy(
            ...orderByMsTimestampIdDesc(
              shopSaleAuthorityRequest.createdAt,
              shopSaleAuthorityRequest.id,
            ),
          )
          .limit(limit + 1);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page.at(-1);
        return {
          items: page.map(({ request, artworkTitle, ownerDisplayName }) => ({
            requestId: request.id,
            artworkId: request.artworkId,
            artworkTitle,
            ownerPartyId: request.ownerPartyId,
            ownerDisplayName,
            requestedCount: request.requestedCount,
            status: request.status,
            createdAt: request.createdAt.toISOString(),
          })),
          nextCursor:
            hasMore && last
              ? encodeCatalogueCursor({
                  createdAt: truncateCatalogueCursorDate(last.request.createdAt),
                  id: last.request.id,
                })
              : null,
        };
      },
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
    staff: {
      async listStaffMembers(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const rows = await db
          .select()
          .from(shopStaffMember)
          .where(
            cursor
              ? keysetBeforeCreatedAtId(shopStaffMember.createdAt, shopStaffMember.id, cursor)
              : undefined,
          )
          .orderBy(...orderByMsTimestampIdDesc(shopStaffMember.createdAt, shopStaffMember.id))
          .limit(limit + 1);
        return paginateByCreatedAtId(rows, limit, (row) => ({
          staffMemberId: row.id,
          identitySubjectId: row.identitySubjectId,
          role: row.role,
          disabledAt: row.disabledAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        }));
      },
    },
    catalogue: {
      async listMerchandiseProducts(input) {
        const limit = resolveLimit(input.limit);
        const cursor = decodeCatalogueCursor(input.cursor);
        const products = await db
          .select()
          .from(shopProduct)
          .where(
            cursor
              ? keysetBeforeCreatedAtId(shopProduct.createdAt, shopProduct.id, cursor)
              : undefined,
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
                .where(inArray(shopProductVariant.productId, productIds));
        const byProduct = new Map<string, typeof variants>();
        for (const variant of variants) {
          const bucket = byProduct.get(variant.productId) ?? [];
          bucket.push(variant);
          byProduct.set(variant.productId, bucket);
        }
        const last = page.at(-1);
        return {
          items: page.map((product) => {
            const productVariants = byProduct.get(product.id) ?? [];
            const prices = productVariants.map((v) => v.pricePence);
            return {
              productId: product.id,
              slug: product.slug,
              title: product.title,
              variantCount: productVariants.length,
              fromPricePence: prices.length > 0 ? Math.min(...prices) : null,
              totalOnHand: productVariants.reduce((sum, v) => sum + v.onHand, 0),
            };
          }),
          nextCursor:
            hasMore && last
              ? encodeCatalogueCursor({ createdAt: last.createdAt, id: last.id })
              : null,
        };
      },
    },
    overview: {
      async readOverviewKpis() {
        const [fulfilmentOpen, payoutsDue, activeHolds, pendingRequests] = await Promise.all([
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
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(shopPayoutLedger)
            .where(eq(shopPayoutLedger.status, "due")),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(shopStockHold)
            .where(eq(shopStockHold.status, "active")),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(shopSaleAuthorityRequest)
            .where(eq(shopSaleAuthorityRequest.status, "pending")),
        ]);
        return {
          fulfilmentOpenCount: fulfilmentOpen[0]?.count ?? 0,
          payoutsDueCount: payoutsDue[0]?.count ?? 0,
          activeHoldsCount: activeHolds[0]?.count ?? 0,
          pendingAuthorityRequestsCount: pendingRequests[0]?.count ?? 0,
        };
      },
    },
  };
}
