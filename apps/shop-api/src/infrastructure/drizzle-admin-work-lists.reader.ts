import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopClientAssignment,
  shopDispute,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOriginalSale,
  shopParty,
  shopPayoutLedger,
  shopSaleAuthorityRequest,
  shopSaleFee,
  shopStockHold,
  shopThirdPartySale,
  shopUserProfile,
} from "@auction/db/schema";
import {
  ADMIN_FULFILMENT_OPEN_STATUSES,
  type AdminDisputeListItem,
  type AdminDisputeListQuery,
  type AdminFulfilmentListQuery,
  type AdminOriginalSaleListQuery,
  type AdminPayoutListQuery,
  type AdminSaleAuthorityRequestListQuery,
  type AdminThirdPartySaleListQuery,
} from "@auction/shop-contracts";
import { type SQL, and, asc, count, eq, exists, inArray, notInArray, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { alias } from "drizzle-orm/pg-core";
import {
  type CatalogueCursor,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  truncateCatalogueCursorDate,
} from "../application/catalogue-cursor.js";
import type {
  AdminFulfilmentListItem,
  AdminOriginalSaleListItem,
  AdminPayoutListItem,
  AdminSaleAuthorityRequestListItem,
  AdminStockHoldListItem,
  AdminThirdPartySaleListItem,
  StockHoldListInput,
  WorkListResult,
} from "../application/ports/admin-readers.js";
import {
  type KeysetDirection,
  keysetAfter,
  orderByMsTimestampId,
} from "./admin-created-at-keyset.js";
import { containsPattern } from "./drizzle-editorial-search.reader.js";

/*
 * The staff work lists for sales and operations. Each one filters by its views' status, a search
 * and its own filters; sorts by one timestamp with the id as the tiebreaker, in either direction;
 * pages by keyset; and counts its rows per status under every filter except status, so the view
 * tabs add up to the list.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function resolveWorkListLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

/** "created_desc" → the column key and direction; anything unknown reads as `fallback`. */
export function parseSort<K extends string>(
  sort: string | undefined,
  fallback: `${K}_${KeysetDirection}`,
): { key: K; direction: KeysetDirection } {
  const value = sort ?? fallback;
  const at = value.lastIndexOf("_");
  return {
    key: value.slice(0, at) as K,
    direction: value.slice(at + 1) === "asc" ? "asc" : "desc",
  };
}

/** A search term: `contains` matches anywhere, `prefix` the start (for ids staff quote). */
export function searchPatterns(q: string | undefined): { contains: string; prefix: string } | null {
  const trimmed = q?.trim().replace(/^#/, "");
  if (!trimmed) return null;
  const contains = containsPattern(trimmed);
  return { contains, prefix: contains.slice(1) };
}

function ilike(column: AnyPgColumn | SQL, pattern: string): SQL {
  return sql`${column} ILIKE ${pattern}`;
}

function idPrefix(column: AnyPgColumn, pattern: string): SQL {
  return sql`${column}::text ILIKE ${pattern}`;
}

export function countsOf(
  rows: readonly { status: string; total: number }[],
): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
}

/** The first `limit` rows and the cursor for the rest (the sort column and the id). */
export function pageOf<T, R>(
  rows: readonly T[],
  limit: number,
  keyOf: (row: T) => CatalogueCursor,
  mapRow: (row: T) => R,
): { items: R[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  if (!hasMore || !last) return { items: page.map(mapRow), nextCursor: null };
  const key = keyOf(last);
  return {
    items: page.map(mapRow),
    nextCursor: encodeCatalogueCursor({
      createdAt: truncateCatalogueCursorDate(key.createdAt),
      id: key.id,
    }),
  };
}

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;
const clean = (value: string | null | undefined) => value?.trim() || null;

export function createDrizzleAdminWorkListsReader(db: Database) {
  const clientParty = alias(shopParty, "client_party");
  const brokerParty = alias(shopParty, "broker_party");
  const sellerParty = alias(shopParty, "seller_party");
  const buyerParty = alias(shopParty, "buyer_party");

  return {
    async listFulfilment(
      input: AdminFulfilmentListQuery,
    ): Promise<WorkListResult<AdminFulfilmentListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { direction } = parseSort<"updated">(input.sort, "updated_desc");
      const search = searchPatterns(input.q);
      const open = [...ADMIN_FULFILMENT_OPEN_STATUSES];
      // The stage is a view, like the status: it narrows the rows but not the counts.
      const view = [
        input.stage === "open" ? inArray(shopFulfilment.status, open) : undefined,
        input.stage === "done" ? notInArray(shopFulfilment.status, open) : undefined,
        input.status ? eq(shopFulfilment.status, input.status) : undefined,
      ];
      const filters = [
        input.option ? eq(shopFulfilment.option, input.option) : undefined,
        search
          ? or(
              idPrefix(shopFulfilment.orderId, search.prefix),
              ilike(shopFulfilment.trackingNumber, search.contains),
              ilike(shopUserProfile.name, search.contains),
              ilike(shopUserProfile.email, search.contains),
            )
          : undefined,
      ];
      const base = () =>
        db
          .select({
            fulfilment: shopFulfilment,
            paidAt: shopOrder.paidAt,
            buyerName: shopUserProfile.name,
            buyerEmail: shopUserProfile.email,
          })
          .from(shopFulfilment)
          .innerJoin(shopOrder, eq(shopFulfilment.orderId, shopOrder.id))
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopOrder.identitySubjectId),
          );
      const [rows, countRows] = await Promise.all([
        base()
          .where(
            and(
              ...filters,
              ...view,
              cursor
                ? keysetAfter(shopFulfilment.updatedAt, shopFulfilment.id, cursor, direction)
                : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampId(shopFulfilment.updatedAt, shopFulfilment.id, direction))
          .limit(limit + 1),
        db
          .select({ status: shopFulfilment.status, total: count() })
          .from(shopFulfilment)
          .innerJoin(shopOrder, eq(shopFulfilment.orderId, shopOrder.id))
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopOrder.identitySubjectId),
          )
          .where(and(...filters))
          .groupBy(shopFulfilment.status),
      ]);
      return {
        ...pageOf(
          rows,
          limit,
          (row) => ({ createdAt: row.fulfilment.updatedAt, id: row.fulfilment.id }),
          ({ fulfilment, paidAt, buyerName, buyerEmail }) => ({
            fulfilmentId: fulfilment.id,
            orderId: fulfilment.orderId,
            status: fulfilment.status,
            option: fulfilment.option,
            carrier: fulfilment.carrier,
            trackingNumber: fulfilment.trackingNumber,
            updatedAt: fulfilment.updatedAt.toISOString(),
            possessionAt: iso(fulfilment.possessionAt),
            paidAt: iso(paidAt),
            buyerName: clean(buyerName),
            buyerEmail: clean(buyerEmail),
          }),
        ),
        counts: countsOf(countRows),
      };
    },

    async listPayouts(input: AdminPayoutListQuery): Promise<WorkListResult<AdminPayoutListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { key, direction } = parseSort<"due" | "created">(input.sort, "due_asc");
      const sortColumn =
        key === "created" ? shopPayoutLedger.createdAt : shopPayoutLedger.payoutDueAt;
      const search = searchPatterns(input.q);
      const filters = [
        input.source ? eq(shopPayoutLedger.source, input.source) : undefined,
        search
          ? or(
              ilike(shopParty.displayName, search.contains),
              idPrefix(shopPayoutLedger.id, search.prefix),
              ilike(shopPayoutLedger.paidReference, search.contains),
            )
          : undefined,
      ];
      const [rows, countRows] = await Promise.all([
        db
          .select({ payout: shopPayoutLedger, ownerDisplayName: shopParty.displayName })
          .from(shopPayoutLedger)
          .innerJoin(shopParty, eq(shopPayoutLedger.ownerPartyId, shopParty.id))
          .where(
            and(
              ...filters,
              input.status ? eq(shopPayoutLedger.status, input.status) : undefined,
              cursor ? keysetAfter(sortColumn, shopPayoutLedger.id, cursor, direction) : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampId(sortColumn, shopPayoutLedger.id, direction))
          .limit(limit + 1),
        db
          .select({ status: shopPayoutLedger.status, total: count() })
          .from(shopPayoutLedger)
          .innerJoin(shopParty, eq(shopPayoutLedger.ownerPartyId, shopParty.id))
          .where(and(...filters))
          .groupBy(shopPayoutLedger.status),
      ]);
      return {
        ...pageOf(
          rows,
          limit,
          ({ payout }) => ({
            createdAt: key === "created" ? payout.createdAt : payout.payoutDueAt,
            id: payout.id,
          }),
          ({ payout, ownerDisplayName }) => ({
            payoutId: payout.id,
            ownerPartyId: payout.ownerPartyId,
            ownerDisplayName,
            source: payout.source,
            grossPence: payout.grossPence,
            deductionsPence: payout.deductionsPence,
            netPence: payout.netPence,
            status: payout.status,
            payoutDueAt: payout.payoutDueAt.toISOString(),
            paidAt: iso(payout.paidAt),
            paidReference: payout.paidReference ?? null,
            createdAt: payout.createdAt.toISOString(),
          }),
        ),
        counts: countsOf(countRows),
      };
    },

    async listStockHolds(
      input: StockHoldListInput,
    ): Promise<WorkListResult<AdminStockHoldListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { key, direction } = parseSort<"created" | "expires">(input.sort, "created_desc");
      const sortColumn = key === "expires" ? shopStockHold.expiresAt : shopStockHold.createdAt;
      const search = searchPatterns(input.q);
      const brokerSubjectId = input.brokerSubjectId?.trim();
      const filters = [
        // A broker sees only the holds for the clients assigned to them.
        brokerSubjectId
          ? exists(
              db
                .select({ one: sql`1` })
                .from(shopClientAssignment)
                .where(
                  and(
                    eq(shopClientAssignment.clientPartyId, shopStockHold.clientPartyId),
                    eq(shopClientAssignment.brokerSubjectId, brokerSubjectId),
                  ),
                ),
            )
          : undefined,
        search
          ? or(
              ilike(shopArtwork.title, search.contains),
              ilike(clientParty.displayName, search.contains),
            )
          : undefined,
      ];
      const [rows, countRows] = await Promise.all([
        db
          .select({
            hold: shopStockHold,
            artworkTitle: shopArtwork.title,
            editionNumber: shopEdition.editionNumber,
            clientName: clientParty.displayName,
            brokerName: brokerParty.displayName,
          })
          .from(shopStockHold)
          .innerJoin(shopEdition, eq(shopStockHold.editionId, shopEdition.id))
          .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
          .innerJoin(clientParty, eq(shopStockHold.clientPartyId, clientParty.id))
          .leftJoin(brokerParty, eq(shopStockHold.brokerPartyId, brokerParty.id))
          .where(
            and(
              ...filters,
              input.status ? eq(shopStockHold.status, input.status) : undefined,
              cursor ? keysetAfter(sortColumn, shopStockHold.id, cursor, direction) : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampId(sortColumn, shopStockHold.id, direction))
          .limit(limit + 1),
        db
          .select({ status: shopStockHold.status, total: count() })
          .from(shopStockHold)
          .innerJoin(shopEdition, eq(shopStockHold.editionId, shopEdition.id))
          .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
          .innerJoin(clientParty, eq(shopStockHold.clientPartyId, clientParty.id))
          .where(and(...filters))
          .groupBy(shopStockHold.status),
      ]);
      return {
        ...pageOf(
          rows,
          limit,
          ({ hold }) => ({
            createdAt: key === "expires" ? hold.expiresAt : hold.createdAt,
            id: hold.id,
          }),
          ({ hold, artworkTitle, editionNumber, clientName, brokerName }) => ({
            holdId: hold.id,
            editionId: hold.editionId,
            artworkTitle,
            editionNumber,
            status: hold.status,
            expiresAt: hold.expiresAt.toISOString(),
            brokerPartyId: hold.brokerPartyId,
            clientPartyId: hold.clientPartyId,
            clientName,
            brokerName: brokerName ?? null,
            note: clean(hold.note),
            createdAt: hold.createdAt.toISOString(),
          }),
        ),
        counts: countsOf(countRows),
      };
    },

    async listThirdPartySales(
      input: AdminThirdPartySaleListQuery,
    ): Promise<WorkListResult<AdminThirdPartySaleListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { direction } = parseSort<"created">(input.sort, "created_desc");
      const search = searchPatterns(input.q);
      const filters = [
        input.fee === "pending"
          ? exists(
              db
                .select({ one: sql`1` })
                .from(shopSaleFee)
                .where(
                  and(
                    eq(shopSaleFee.thirdPartySaleId, shopThirdPartySale.id),
                    eq(shopSaleFee.status, "pending"),
                  ),
                ),
            )
          : undefined,
        search
          ? or(
              ilike(shopArtwork.title, search.contains),
              ilike(sellerParty.displayName, search.contains),
              ilike(buyerParty.displayName, search.contains),
            )
          : undefined,
      ];
      const [rows, countRows] = await Promise.all([
        db
          .select({
            sale: shopThirdPartySale,
            artworkTitle: shopArtwork.title,
            editionNumber: shopEdition.editionNumber,
            sellerName: sellerParty.displayName,
            buyerName: buyerParty.displayName,
          })
          .from(shopThirdPartySale)
          .innerJoin(shopEdition, eq(shopThirdPartySale.editionId, shopEdition.id))
          .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
          .innerJoin(sellerParty, eq(shopThirdPartySale.sellerPartyId, sellerParty.id))
          .innerJoin(buyerParty, eq(shopThirdPartySale.buyerPartyId, buyerParty.id))
          .where(
            and(
              ...filters,
              input.status ? eq(shopThirdPartySale.status, input.status) : undefined,
              cursor
                ? keysetAfter(
                    shopThirdPartySale.createdAt,
                    shopThirdPartySale.id,
                    cursor,
                    direction,
                  )
                : undefined,
            ),
          )
          .orderBy(
            ...orderByMsTimestampId(shopThirdPartySale.createdAt, shopThirdPartySale.id, direction),
          )
          .limit(limit + 1),
        db
          .select({ status: shopThirdPartySale.status, total: count() })
          .from(shopThirdPartySale)
          .innerJoin(shopEdition, eq(shopThirdPartySale.editionId, shopEdition.id))
          .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
          .innerJoin(sellerParty, eq(shopThirdPartySale.sellerPartyId, sellerParty.id))
          .innerJoin(buyerParty, eq(shopThirdPartySale.buyerPartyId, buyerParty.id))
          .where(and(...filters))
          .groupBy(shopThirdPartySale.status),
      ]);
      const page = pageOf(
        rows,
        limit,
        ({ sale }) => ({ createdAt: sale.createdAt, id: sale.id }),
        (row) => row,
      );
      const feeRows = page.items.length
        ? await db
            .select()
            .from(shopSaleFee)
            .where(
              inArray(
                shopSaleFee.thirdPartySaleId,
                page.items.map(({ sale }) => sale.id),
              ),
            )
            .orderBy(asc(shopSaleFee.createdAt), asc(shopSaleFee.id))
        : [];
      return {
        items: page.items.map(({ sale, artworkTitle, editionNumber, sellerName, buyerName }) => ({
          saleId: sale.id,
          editionId: sale.editionId,
          artworkTitle,
          editionNumber,
          status: sale.status,
          grossPence: sale.grossPence,
          recordedAt: iso(sale.recordedAt),
          fees: feeRows
            .filter((fee) => fee.thirdPartySaleId === sale.id)
            .map((fee) => ({
              feeId: fee.id,
              label: fee.label,
              amountPence: fee.amountPence,
              status: fee.status,
            })),
          sellerName,
          buyerName,
          createdAt: sale.createdAt.toISOString(),
        })),
        nextCursor: page.nextCursor,
        counts: countsOf(countRows),
      };
    },

    async listOriginalSales(
      input: AdminOriginalSaleListQuery,
    ): Promise<WorkListResult<AdminOriginalSaleListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { direction } = parseSort<"created">(input.sort, "created_desc");
      const search = searchPatterns(input.q);
      const filters = [
        search
          ? or(
              ilike(shopArtwork.title, search.contains),
              ilike(shopParty.displayName, search.contains),
              ilike(shopUserProfile.email, search.contains),
            )
          : undefined,
      ];
      const [rows, countRows] = await Promise.all([
        db
          .select({
            sale: shopOriginalSale,
            artworkTitle: shopArtwork.title,
            buyerName: shopParty.displayName,
            buyerEmail: shopUserProfile.email,
          })
          .from(shopOriginalSale)
          .innerJoin(shopArtwork, eq(shopOriginalSale.artworkId, shopArtwork.id))
          .innerJoin(shopParty, eq(shopOriginalSale.buyerPartyId, shopParty.id))
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopParty.identitySubjectId),
          )
          .where(
            and(
              ...filters,
              input.status ? eq(shopOriginalSale.status, input.status) : undefined,
              cursor
                ? keysetAfter(shopOriginalSale.createdAt, shopOriginalSale.id, cursor, direction)
                : undefined,
            ),
          )
          .orderBy(
            ...orderByMsTimestampId(shopOriginalSale.createdAt, shopOriginalSale.id, direction),
          )
          .limit(limit + 1),
        db
          .select({ status: shopOriginalSale.status, total: count() })
          .from(shopOriginalSale)
          .innerJoin(shopArtwork, eq(shopOriginalSale.artworkId, shopArtwork.id))
          .innerJoin(shopParty, eq(shopOriginalSale.buyerPartyId, shopParty.id))
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopParty.identitySubjectId),
          )
          .where(and(...filters))
          .groupBy(shopOriginalSale.status),
      ]);
      return {
        ...pageOf(
          rows,
          limit,
          ({ sale }) => ({ createdAt: sale.createdAt, id: sale.id }),
          ({ sale, artworkTitle, buyerName, buyerEmail }) => ({
            saleId: sale.id,
            artworkId: sale.artworkId,
            artworkTitle,
            status: sale.status,
            salePricePence: sale.salePricePence,
            createdAt: sale.createdAt.toISOString(),
            buyerName,
            buyerEmail: buyerEmail ?? null,
            reservationExpiresAt: iso(sale.reservationExpiresAt),
          }),
        ),
        counts: countsOf(countRows),
      };
    },

    async listRequests(
      input: AdminSaleAuthorityRequestListQuery,
    ): Promise<WorkListResult<AdminSaleAuthorityRequestListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { direction } = parseSort<"created">(input.sort, "created_desc");
      const search = searchPatterns(input.q);
      const filters = [
        search
          ? or(
              ilike(shopArtwork.title, search.contains),
              ilike(shopParty.displayName, search.contains),
            )
          : undefined,
      ];
      const [rows, countRows] = await Promise.all([
        db
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
              ...filters,
              input.status ? eq(shopSaleAuthorityRequest.status, input.status) : undefined,
              cursor
                ? keysetAfter(
                    shopSaleAuthorityRequest.createdAt,
                    shopSaleAuthorityRequest.id,
                    cursor,
                    direction,
                  )
                : undefined,
            ),
          )
          .orderBy(
            ...orderByMsTimestampId(
              shopSaleAuthorityRequest.createdAt,
              shopSaleAuthorityRequest.id,
              direction,
            ),
          )
          .limit(limit + 1),
        db
          .select({ status: shopSaleAuthorityRequest.status, total: count() })
          .from(shopSaleAuthorityRequest)
          .innerJoin(shopArtwork, eq(shopSaleAuthorityRequest.artworkId, shopArtwork.id))
          .innerJoin(shopParty, eq(shopSaleAuthorityRequest.ownerPartyId, shopParty.id))
          .where(and(...filters))
          .groupBy(shopSaleAuthorityRequest.status),
      ]);
      return {
        ...pageOf(
          rows,
          limit,
          ({ request }) => ({ createdAt: request.createdAt, id: request.id }),
          ({ request, artworkTitle, ownerDisplayName }) => ({
            requestId: request.id,
            artworkId: request.artworkId,
            artworkTitle,
            ownerPartyId: request.ownerPartyId,
            ownerDisplayName,
            requestedCount: request.requestedCount,
            status: request.status,
            createdAt: request.createdAt.toISOString(),
            note: clean(request.note),
            declineReason: clean(request.declineReason),
            handledAt: iso(request.handledAt),
          }),
        ),
        counts: countsOf(countRows),
      };
    },

    async listDisputes(
      input: AdminDisputeListQuery,
    ): Promise<WorkListResult<AdminDisputeListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { direction } = parseSort<"opened">(input.sort, "opened_desc");
      const search = searchPatterns(input.q);
      const filters = [
        search
          ? or(
              idPrefix(shopDispute.orderId, search.prefix),
              ilike(shopDispute.stripeDisputeId, search.contains),
              ilike(shopUserProfile.name, search.contains),
              ilike(shopUserProfile.email, search.contains),
            )
          : undefined,
      ];
      const [rows, countRows] = await Promise.all([
        db
          .select({
            dispute: shopDispute,
            buyerName: shopUserProfile.name,
            buyerEmail: shopUserProfile.email,
          })
          .from(shopDispute)
          .innerJoin(shopOrder, eq(shopDispute.orderId, shopOrder.id))
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopOrder.identitySubjectId),
          )
          .where(
            and(
              ...filters,
              input.status ? eq(shopDispute.status, input.status) : undefined,
              cursor
                ? keysetAfter(shopDispute.openedAt, shopDispute.id, cursor, direction)
                : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampId(shopDispute.openedAt, shopDispute.id, direction))
          .limit(limit + 1),
        db
          .select({ status: shopDispute.status, total: count() })
          .from(shopDispute)
          .innerJoin(shopOrder, eq(shopDispute.orderId, shopOrder.id))
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopOrder.identitySubjectId),
          )
          .where(and(...filters))
          .groupBy(shopDispute.status),
      ]);
      return {
        ...pageOf(
          rows,
          limit,
          ({ dispute }) => ({ createdAt: dispute.openedAt, id: dispute.id }),
          ({ dispute, buyerName, buyerEmail }) => ({
            disputeId: dispute.id,
            orderId: dispute.orderId,
            stripeDisputeId: dispute.stripeDisputeId,
            status: dispute.status,
            amountPence: dispute.amountPence,
            openedAt: dispute.openedAt.toISOString(),
            closedAt: iso(dispute.closedAt),
            buyerName: clean(buyerName),
            buyerEmail: clean(buyerEmail),
          }),
        ),
        counts: countsOf(countRows),
      };
    },
  };
}
