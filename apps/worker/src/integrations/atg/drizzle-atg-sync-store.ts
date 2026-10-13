import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { artistProfile, atgAuctionLink, atgLotLink, lot, sale } from "@auction/db/schema";
import { and, asc, eq, gt, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { AtgRemoteLot } from "./atg-gateway.js";
import type { AtgAuctionLinkPatch, AtgLotLinkPatch, AtgSyncStore } from "./atg-sync-store.js";
import type { AtgAuctionLink, AtgLotLink, AtgRemoteStatus, AtgSaleSnapshot } from "./atg-types.js";

const LIVE_STATUSES: AtgRemoteStatus[] = ["created", "approved", "published"];

function money(value: number | null): string | null {
  return value == null ? null : value.toFixed(2);
}

function toAuctionLink(row: typeof atgAuctionLink.$inferSelect): AtgAuctionLink {
  return {
    saleId: row.saleId,
    atgAuctionId: row.atgAuctionId,
    remoteStatus: row.remoteStatus as AtgRemoteStatus,
    payloadHash: row.payloadHash,
    lastSyncedAt: row.lastSyncedAt,
    closedAt: row.closedAt,
  };
}

function toLotLink(row: typeof atgLotLink.$inferSelect): AtgLotLink {
  return {
    lotId: row.lotId,
    saleId: row.saleId,
    atgLotId: row.atgLotId,
    imageNames: row.imageNames,
    payloadHash: row.payloadHash,
  };
}

export class DrizzleAtgSyncStore implements AtgSyncStore {
  constructor(private readonly db: Database) {}

  async loadSale(saleId: string): Promise<AtgSaleSnapshot | null> {
    const [saleRow] = await this.db
      .select()
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);
    if (!saleRow) return null;

    const lotRows = await this.db
      .select({ lot, artistName: artistProfile.displayName })
      .from(lot)
      .leftJoin(artistProfile, eq(artistProfile.id, lot.artistId))
      .where(and(eq(lot.saleId, saleId), lotNotDeleted()))
      .orderBy(sql`${lot.lotNumber} asc nulls last`, asc(lot.createdAt));

    return {
      id: saleRow.id,
      title: saleRow.title,
      description: saleRow.description,
      terms: saleRow.terms,
      startTime: saleRow.startTime,
      endTime: saleRow.endTime,
      buyerPremiumRate: saleRow.buyerPremiumRate,
      locationAddressLine1: saleRow.locationAddressLine1,
      locationAddressLine2: saleRow.locationAddressLine2,
      locationCity: saleRow.locationCity,
      locationPostcode: saleRow.locationPostcode,
      locationCountry: saleRow.locationCountry,
      updatedAt: saleRow.updatedAt,
      lots: lotRows.map(({ lot: row, artistName }) => ({
        id: row.id,
        lotNumber: row.lotNumber,
        title: row.title,
        description: row.description,
        medium: row.medium,
        dimensions: row.dimensions,
        artistName: artistName ?? null,
        images: row.images,
        startingPrice: row.startingPrice,
        reservePrice: row.reservePrice,
        buyNowPrice: row.buyNowPrice,
        buyerPremiumRate: row.buyerPremiumRate,
        endTime: row.endTime,
        marketingDetails: row.marketingDetails,
        updatedAt: row.updatedAt,
      })),
    };
  }

  async getAuctionLink(saleId: string): Promise<AtgAuctionLink | null> {
    const [row] = await this.db
      .select()
      .from(atgAuctionLink)
      .where(eq(atgAuctionLink.saleId, saleId))
      .limit(1);
    return row ? toAuctionLink(row) : null;
  }

  async saveAuctionLink(saleId: string, patch: AtgAuctionLinkPatch): Promise<void> {
    await this.db
      .insert(atgAuctionLink)
      .values({ saleId, ...patch })
      .onConflictDoUpdate({
        target: atgAuctionLink.saleId,
        set: { ...patch, updatedAt: new Date() },
      });
  }

  async listLotLinks(saleId: string): Promise<AtgLotLink[]> {
    const rows = await this.db.select().from(atgLotLink).where(eq(atgLotLink.saleId, saleId));
    return rows.map(toLotLink);
  }

  async getLotLink(lotId: string): Promise<AtgLotLink | null> {
    const [row] = await this.db
      .select()
      .from(atgLotLink)
      .where(eq(atgLotLink.lotId, lotId))
      .limit(1);
    return row ? toLotLink(row) : null;
  }

  async insertLotLink(
    link: Pick<AtgLotLink, "lotId" | "saleId" | "atgLotId"> & { payloadHash: string },
  ): Promise<void> {
    await this.db.insert(atgLotLink).values(link);
  }

  async updateLotLink(lotId: string, patch: AtgLotLinkPatch): Promise<void> {
    await this.db
      .update(atgLotLink)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(atgLotLink.lotId, lotId));
  }

  async deleteLotLink(lotId: string): Promise<void> {
    await this.db.delete(atgLotLink).where(eq(atgLotLink.lotId, lotId));
  }

  async applyRemoteLots(saleId: string, lots: AtgRemoteLot[], polledAt: Date): Promise<void> {
    if (lots.length === 0) return;
    await this.db.transaction(async (tx) => {
      for (const remote of lots) {
        await tx
          .update(atgLotLink)
          .set({
            currentMaxBid: money(remote.currentMaxBid),
            numberOfBids: remote.numberOfBids,
            sold: remote.sold,
            hammerPrice: money(remote.hammerPrice),
            winningBidderId: remote.winningBidderId,
            status: remote.status == null ? null : String(remote.status),
            lastPolledAt: polledAt,
            updatedAt: polledAt,
          })
          .where(and(eq(atgLotLink.saleId, saleId), eq(atgLotLink.atgLotId, remote.atgLotId)));
      }
    });
  }

  async listActiveAuctionLinks(closedSince: Date): Promise<AtgAuctionLink[]> {
    const rows = await this.db
      .select()
      .from(atgAuctionLink)
      .where(
        and(
          isNotNull(atgAuctionLink.atgAuctionId),
          or(
            inArray(atgAuctionLink.remoteStatus, LIVE_STATUSES),
            and(
              eq(atgAuctionLink.remoteStatus, "closed"),
              gte(atgAuctionLink.closedAt, closedSince),
            ),
          ),
        ),
      );
    return rows.map(toAuctionLink);
  }

  async hasCatalogueChangesSince(saleId: string, since: Date): Promise<boolean> {
    const [saleChanged] = await this.db
      .select({ id: sale.id })
      .from(sale)
      .where(and(eq(sale.id, saleId), gt(sale.updatedAt, since)))
      .limit(1);
    if (saleChanged) return true;
    const [lotChanged] = await this.db
      .select({ id: lot.id })
      .from(lot)
      .where(
        and(
          or(
            eq(lot.saleId, saleId),
            inArray(
              lot.id,
              this.db
                .select({ id: atgLotLink.lotId })
                .from(atgLotLink)
                .where(eq(atgLotLink.saleId, saleId)),
            ),
          ),
          or(gt(lot.updatedAt, since), gt(lot.deletedAt, since)),
        ),
      )
      .limit(1);
    return Boolean(lotChanged);
  }
}
