import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { atgAuctionLink, atgLotLink, lot, sale } from "@auction/db/schema";
import type { AtgRemoteStatus, AtgSaleResultRow, AtgSaleSyncView } from "@auction/types";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { IAtgLinkReader } from "./interfaces/atg-link.reader.js";

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
    return {
      saleId: row.saleId,
      saleCancelled: row.saleStatus === "cancelled",
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

  async findAtgLotId(lotId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ atgLotId: atgLotLink.atgLotId })
      .from(atgLotLink)
      .where(eq(atgLotLink.lotId, lotId))
      .limit(1);
    return row?.atgLotId ?? null;
  }
}
