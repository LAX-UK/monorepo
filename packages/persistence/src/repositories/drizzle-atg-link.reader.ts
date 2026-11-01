import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { atgAuctionLink, atgLotLink, lot, sale } from "@auction/db/schema";
import {
  type AtgAuctionType,
  type AtgDistribution,
  type AtgLotChannelState,
  type AtgLotSellingSummary,
  type AtgRemoteStatus,
  type AtgSaleOwnershipSnapshot,
  type AtgSaleResultRow,
  type AtgSaleSellingSummary,
  type AtgSaleSyncView,
  DEFAULT_ATG_SALE_SETTINGS,
  type ResolveSaleSellingPlatformInput,
  type SaleStatus,
  resolveSaleSellingPlatform,
  toAtgSaleSellingSummary,
} from "@auction/types";
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import type { IAtgLinkReader } from "../interfaces/index.js";

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

type OwnershipRow = ResolveSaleSellingPlatformInput & {
  atgApprovedAt: string | null;
  atgDistribution: AtgDistribution;
};

export class DrizzleAtgLinkReader implements IAtgLinkReader {
  constructor(private readonly db: Database) {}

  async getSaleView(saleId: string): Promise<AtgSaleSyncView | null> {
    const [row] = await this.db
      .select({ saleId: sale.id, saleStatus: sale.status, link: atgAuctionLink })
      .from(sale)
      .leftJoin(atgAuctionLink, eq(atgAuctionLink.saleId, sale.id))
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);
    if (!row) return null;

    const lotRows = await this.db
      .select({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        link: atgLotLink,
      })
      .from(lot)
      .leftJoin(atgLotLink, eq(atgLotLink.lotId, lot.id))
      .where(and(eq(lot.saleId, saleId), lotNotDeleted(), ne(lot.status, "cancelled")))
      .orderBy(sql`${lot.lotNumber} asc nulls last`, asc(lot.createdAt));

    const link = row.link;
    const saleStatus = row.saleStatus as SaleStatus;
    const sellingPlatform = resolveSaleSellingPlatform({
      saleStatus,
      atgRemoteStatus: (link?.remoteStatus as AtgRemoteStatus | undefined) ?? null,
      atgLinked: Boolean(link?.atgAuctionId),
      atgSoldLotCount: lotRows.filter((r) => r.link?.sold === true).length,
    });
    return {
      saleId: row.saleId,
      saleStatus,
      sellingPlatform,
      saleCancelled: saleStatus === "cancelled",
      linked: Boolean(link?.atgAuctionId),
      atgAuctionId: link?.atgAuctionId ?? null,
      remoteStatus: (link?.remoteStatus as AtgRemoteStatus | undefined) ?? null,
      approvedAt: iso(link?.atgApprovedAt ?? null),
      publishedAt: iso(link?.publishedAt ?? null),
      closedAt: iso(link?.closedAt ?? null),
      lastSyncedAt: iso(link?.lastSyncedAt ?? null),
      lastPolledAt: iso(link?.lastPolledAt ?? null),
      lastError: link?.lastError ?? null,
      settings: {
        auctionType:
          (link?.auctionType as AtgAuctionType | undefined) ??
          DEFAULT_ATG_SALE_SETTINGS.auctionType,
        distribution:
          (link?.distribution as AtgDistribution | undefined) ??
          DEFAULT_ATG_SALE_SETTINGS.distribution,
      },
      settingsUpdatedAt: iso(link?.settingsUpdatedAt ?? null),
      results: (link?.resultsSnapshot as AtgSaleResultRow[] | null | undefined) ?? [],
      lots: lotRows.map((r) => ({
        lotId: r.lotId,
        lotNumber: r.lotNumber,
        title: r.title,
        atgLotId: r.link?.atgLotId ?? null,
        imageCount: r.link?.imageNames.length ?? 0,
        lastSyncedAt: iso(r.link?.lastSyncedAt ?? null),
        lastError: r.link?.lastError ?? null,
        remoteStatus: r.link?.status ?? null,
        sold: r.link?.sold ?? null,
        hammerPrice: r.link?.hammerPrice ?? null,
        currentMaxBid: r.link?.currentMaxBid ?? null,
        numberOfBids: r.link?.numberOfBids ?? null,
        lastPolledAt: iso(r.link?.lastPolledAt ?? null),
      })),
    };
  }

  async getSaleOwnership(saleId: string): Promise<AtgSaleOwnershipSnapshot | null> {
    return (await this.getSaleOwnerships([saleId])).get(saleId) ?? null;
  }

  async getSaleOwnerships(saleIds: string[]): Promise<Map<string, AtgSaleOwnershipSnapshot>> {
    const out = new Map<string, AtgSaleOwnershipSnapshot>();
    for (const [saleId, row] of await this.ownershipRows(saleIds)) {
      out.set(saleId, {
        saleStatus: row.saleStatus,
        atgRemoteStatus: row.atgRemoteStatus,
        atgLinked: row.atgLinked,
        atgSoldLotCount: row.atgSoldLotCount,
        sellingPlatform: resolveSaleSellingPlatform(row),
        atgDistribution: row.atgDistribution,
      });
    }
    return out;
  }

  async getSaleSellingSummaries(saleIds: string[]): Promise<Map<string, AtgSaleSellingSummary>> {
    const out = new Map<string, AtgSaleSellingSummary>();
    for (const [saleId, row] of await this.ownershipRows(saleIds)) {
      out.set(saleId, toAtgSaleSellingSummary(row));
    }
    return out;
  }

  async getLotSellingSummaries(lotIds: string[]): Promise<Map<string, AtgLotSellingSummary>> {
    const out = new Map<string, AtgLotSellingSummary>();
    if (lotIds.length === 0) return out;
    const rows = await this.db
      .select({
        lotId: lot.id,
        saleId: lot.saleId,
        atgLotId: atgLotLink.atgLotId,
        remoteStatus: atgLotLink.status,
        lastError: atgLotLink.lastError,
        sold: atgLotLink.sold,
        numberOfBids: atgLotLink.numberOfBids,
      })
      .from(lot)
      .leftJoin(atgLotLink, eq(atgLotLink.lotId, lot.id))
      .where(and(inArray(lot.id, lotIds), lotNotDeleted()));
    const saleIds = [...new Set(rows.flatMap((r) => (r.saleId ? [r.saleId] : [])))];
    const sales = await this.getSaleSellingSummaries(saleIds);
    for (const row of rows) {
      out.set(row.lotId, {
        saleId: row.saleId,
        sale: row.saleId ? (sales.get(row.saleId) ?? null) : null,
        lot: row.atgLotId
          ? {
              remoteStatus: row.remoteStatus,
              lastError: row.lastError,
              sold: row.sold,
              numberOfBids: row.numberOfBids,
            }
          : null,
      });
    }
    return out;
  }

  /** One query for the link rows plus one grouped count of sold lots, for any number of sales. */
  private async ownershipRows(saleIds: string[]): Promise<Map<string, OwnershipRow>> {
    const out = new Map<string, OwnershipRow>();
    if (saleIds.length === 0) return out;
    const rows = await this.db
      .select({
        saleId: sale.id,
        saleStatus: sale.status,
        remoteStatus: atgAuctionLink.remoteStatus,
        atgAuctionId: atgAuctionLink.atgAuctionId,
        approvedAt: atgAuctionLink.atgApprovedAt,
        distribution: atgAuctionLink.distribution,
      })
      .from(sale)
      .leftJoin(atgAuctionLink, eq(atgAuctionLink.saleId, sale.id))
      .where(and(inArray(sale.id, saleIds), saleNotDeleted()));
    const linkedIds = rows.filter((r) => r.atgAuctionId).map((r) => r.saleId);
    const soldRows =
      linkedIds.length === 0
        ? []
        : await this.db
            .select({ saleId: atgLotLink.saleId, n: count() })
            .from(atgLotLink)
            .where(and(inArray(atgLotLink.saleId, linkedIds), eq(atgLotLink.sold, true)))
            .groupBy(atgLotLink.saleId);
    const soldBySale = new Map(soldRows.map((r) => [r.saleId, Number(r.n)]));
    for (const row of rows) {
      out.set(row.saleId, {
        saleStatus: row.saleStatus as SaleStatus,
        atgRemoteStatus: (row.remoteStatus as AtgRemoteStatus | undefined) ?? null,
        atgLinked: Boolean(row.atgAuctionId),
        atgSoldLotCount: soldBySale.get(row.saleId) ?? 0,
        atgApprovedAt: iso(row.approvedAt ?? null),
        atgDistribution:
          (row.distribution as AtgDistribution | null) ?? DEFAULT_ATG_SALE_SETTINGS.distribution,
      });
    }
    return out;
  }

  async getLotAtgState(lotId: string): Promise<AtgLotChannelState> {
    const [row] = await this.db
      .select({
        atgLotId: atgLotLink.atgLotId,
        numberOfBids: atgLotLink.numberOfBids,
        sold: atgLotLink.sold,
      })
      .from(atgLotLink)
      .where(eq(atgLotLink.lotId, lotId))
      .limit(1);
    if (!row?.atgLotId) {
      return { linked: false, numberOfBids: 0, sold: false };
    }
    return {
      linked: true,
      numberOfBids: row.numberOfBids ?? 0,
      sold: row.sold ?? false,
    };
  }

  async getSoldLotIds(saleId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ lotId: atgLotLink.lotId })
      .from(atgLotLink)
      .where(and(eq(atgLotLink.saleId, saleId), eq(atgLotLink.sold, true)));
    return new Set(rows.map((r) => r.lotId));
  }

  async findAtgLotId(lotId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ atgLotId: atgLotLink.atgLotId })
      .from(atgLotLink)
      .where(eq(atgLotLink.lotId, lotId))
      .limit(1);
    return row?.atgLotId ?? null;
  }
}
