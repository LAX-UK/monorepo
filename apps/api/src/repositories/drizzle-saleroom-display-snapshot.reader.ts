import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { bid, lot, sale, saleRegistration, saleroomSession } from "@auction/db/schema";
import type { SaleroomDisplayOverlay } from "@auction/types";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { CatalogLotRow } from "../services/display-snapshot-reader.helpers.js";
import type {
  ISaleroomDisplaySnapshotReader,
  SaleroomDisplayCurrentLotRow,
  SaleroomDisplayRecentBidRow,
  SaleroomDisplaySaleRow,
  SaleroomDisplaySessionRow,
} from "./interfaces/saleroom-display-snapshot.reader.js";

export class DrizzleSaleroomDisplaySnapshotReader implements ISaleroomDisplaySnapshotReader {
  constructor(private readonly db: Database) {}

  async findSale(saleId: string): Promise<SaleroomDisplaySaleRow | null> {
    const [saleRow] = await this.db
      .select({
        id: sale.id,
        title: sale.title,
        deliveryMode: sale.deliveryMode,
        coverImages: sale.coverImages,
      })
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);
    return saleRow ?? null;
  }

  async findSession(saleId: string): Promise<SaleroomDisplaySessionRow | null> {
    const [session] = await this.db
      .select({
        status: saleroomSession.status,
        currentLotId: saleroomSession.currentLotId,
        displayOverlay: saleroomSession.displayOverlay,
        startedAt: saleroomSession.startedAt,
      })
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);
    if (!session) return null;
    return {
      status: session.status,
      currentLotId: session.currentLotId,
      displayOverlay: (session.displayOverlay as SaleroomDisplayOverlay | null) ?? null,
      startedAt: session.startedAt,
    };
  }

  async findCurrentLot(lotId: string): Promise<SaleroomDisplayCurrentLotRow | null> {
    const [lotRow] = await this.db
      .select({
        id: lot.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        images: lot.images,
        currentPrice: lot.currentPrice,
        marketingDetails: lot.marketingDetails,
        minBidIncrement: lot.minBidIncrement,
      })
      .from(lot)
      .where(and(eq(lot.id, lotId), lotNotDeleted()))
      .limit(1);
    if (!lotRow) return null;
    return {
      id: lotRow.id,
      lotNumber: lotRow.lotNumber,
      title: lotRow.title,
      images: lotRow.images,
      currentPrice: String(lotRow.currentPrice),
      marketingDetails: lotRow.marketingDetails as Record<string, unknown> | null,
      minBidIncrement: lotRow.minBidIncrement != null ? String(lotRow.minBidIncrement) : null,
    };
  }

  async countBidsForLot(lotId: string): Promise<number> {
    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bid)
      .where(eq(bid.lotId, lotId));
    return countRow?.count ?? 0;
  }

  async findWinningBidderId(lotId: string): Promise<string | null> {
    const [winner] = await this.db
      .select({ bidderId: bid.bidderId })
      .from(bid)
      .where(and(eq(bid.lotId, lotId), eq(bid.isWinning, true)))
      .limit(1);
    return winner?.bidderId ?? null;
  }

  async findCheckedInPaddleNumber(saleId: string, userId: string): Promise<number | null> {
    const [reg] = await this.db
      .select({ paddleNumber: saleRegistration.paddleNumber })
      .from(saleRegistration)
      .where(and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.userId, userId)))
      .limit(1);
    return reg?.paddleNumber ?? null;
  }

  async listRecentBids(lotId: string, limit: number): Promise<SaleroomDisplayRecentBidRow[]> {
    const recentBidRows = await this.db
      .select({
        id: bid.id,
        amount: bid.amount,
        placedVia: bid.placedVia,
        isAutoBid: bid.isAutoBid,
        createdAt: bid.createdAt,
      })
      .from(bid)
      .where(eq(bid.lotId, lotId))
      .orderBy(desc(bid.createdAt))
      .limit(limit);
    return recentBidRows.map((r) => ({
      id: r.id,
      amount: String(r.amount),
      placedVia: r.placedVia ?? null,
      isAutoBid: r.isAutoBid === true,
      createdAt: r.createdAt,
    }));
  }

  async listCatalogLots(saleId: string): Promise<CatalogLotRow[]> {
    const catalogRows = await this.db
      .select({
        id: lot.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        images: lot.images,
        marketingDetails: lot.marketingDetails,
      })
      .from(lot)
      .where(
        and(eq(lot.saleId, saleId), lotNotDeleted(), inArray(lot.status, ["scheduled", "active"])),
      )
      .orderBy(sql`${lot.lotNumber} asc nulls last`);
    return catalogRows as CatalogLotRow[];
  }
}
