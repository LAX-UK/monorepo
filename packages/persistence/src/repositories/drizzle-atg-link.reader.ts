import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { atgAuctionLink, atgLotLink, lot, sale } from "@auction/db/schema";
import {
  type AtgLotChannelState,
  type AtgRemoteStatus,
  type AtgSaleOwnershipSnapshot,
  type AtgSaleResultRow,
  type AtgSaleSyncView,
  type SaleStatus,
  resolveSaleSellingPlatform,
} from "@auction/types";
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import type { IAtgLinkReader } from "../interfaces/index.js";

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

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
      publishedAt: iso(link?.publishedAt ?? null),
      closedAt: iso(link?.closedAt ?? null),
      lastSyncedAt: iso(link?.lastSyncedAt ?? null),
      lastPolledAt: iso(link?.lastPolledAt ?? null),
      lastError: link?.lastError ?? null,
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
    if (saleIds.length === 0) return out;
    const rows = await this.db
      .select({
        saleId: sale.id,
        saleStatus: sale.status,
        remoteStatus: atgAuctionLink.remoteStatus,
        atgAuctionId: atgAuctionLink.atgAuctionId,
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
      const saleStatus = row.saleStatus as SaleStatus;
      const atgRemoteStatus = (row.remoteStatus as AtgRemoteStatus | undefined) ?? null;
      const atgLinked = Boolean(row.atgAuctionId);
      const atgSoldLotCount = soldBySale.get(row.saleId) ?? 0;
      out.set(row.saleId, {
        saleStatus,
        atgRemoteStatus,
        atgLinked,
        atgSoldLotCount,
        sellingPlatform: resolveSaleSellingPlatform({
          saleStatus,
          atgRemoteStatus,
          atgLinked,
          atgSoldLotCount,
        }),
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
