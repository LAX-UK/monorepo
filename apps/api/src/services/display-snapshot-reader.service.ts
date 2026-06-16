import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { bid, lot, sale, saleRegistration, saleroomSession } from "@auction/db/schema";
import type { SaleroomDisplayOverlay, SaleroomDisplaySnapshot } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { and, eq, sql } from "drizzle-orm";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";
import type { IDisplaySnapshotReader } from "./interfaces/display-snapshot-reader.js";

export type DisplaySnapshotReaderOptions = {
  db: Database;
  mediaUrlResolver: MediaUrlResolver;
};

export class DisplaySnapshotReader implements IDisplaySnapshotReader {
  private readonly db: Database;
  private readonly mediaUrlResolver: MediaUrlResolver;

  constructor(opts: DisplaySnapshotReaderOptions) {
    this.db = opts.db;
    this.mediaUrlResolver = opts.mediaUrlResolver;
  }

  async getSnapshot(saleId: string): Promise<SaleroomDisplaySnapshot | null> {
    const [saleRow] = await this.db
      .select({ id: sale.id, title: sale.title, deliveryMode: sale.deliveryMode })
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);
    if (!saleRow || !isSaleroomDeliveryMode(saleRow.deliveryMode)) {
      return null;
    }

    const [session] = await this.db
      .select({
        status: saleroomSession.status,
        currentLotId: saleroomSession.currentLotId,
        displayOverlay: saleroomSession.displayOverlay,
      })
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);

    const sessionStatus = session?.status ?? "none";
    const currentLotId = session?.currentLotId ?? null;
    const overlay = (session?.displayOverlay as SaleroomDisplayOverlay | null) ?? null;

    let currentLot: SaleroomDisplaySnapshot["currentLot"] = null;
    if (currentLotId) {
      const [lotRow] = await this.db
        .select({
          id: lot.id,
          lotNumber: lot.lotNumber,
          title: lot.title,
          images: lot.images,
          currentPrice: lot.currentPrice,
        })
        .from(lot)
        .where(and(eq(lot.id, currentLotId), lotNotDeleted()))
        .limit(1);

      if (lotRow) {
        const [countRow] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(bid)
          .where(eq(bid.lotId, currentLotId));
        const [winner] = await this.db
          .select({ bidderId: bid.bidderId })
          .from(bid)
          .where(and(eq(bid.lotId, currentLotId), eq(bid.isWinning, true)))
          .limit(1);

        let leaderPaddleNumber: number | null = null;
        if (winner?.bidderId) {
          const [reg] = await this.db
            .select({ paddleNumber: saleRegistration.paddleNumber })
            .from(saleRegistration)
            .where(
              and(
                eq(saleRegistration.saleId, saleId),
                eq(saleRegistration.userId, winner.bidderId),
              ),
            )
            .limit(1);
          leaderPaddleNumber = reg?.paddleNumber ?? null;
        }

        const firstImageKey = lotRow.images?.[0] ?? null;
        const imageUrl = firstImageKey ? await this.mediaUrlResolver.resolve(firstImageKey) : null;

        currentLot = {
          id: lotRow.id,
          lotNumber: lotRow.lotNumber ?? 0,
          title: lotRow.title,
          imageUrl,
          currentPrice: String(lotRow.currentPrice),
          bidCount: countRow?.count ?? 0,
          leaderPaddleNumber,
        };
      }
    }

    return {
      saleId,
      saleTitle: saleRow.title,
      sessionStatus: session ? sessionStatus : "none",
      currentLotId,
      currentLot,
      overlay,
    };
  }
}
