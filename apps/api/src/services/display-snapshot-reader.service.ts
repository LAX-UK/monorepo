import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { bid, lot, sale, saleRegistration, saleroomSession } from "@auction/db/schema";
import type {
  SaleroomDisplayNextLot,
  SaleroomDisplayOverlay,
  SaleroomDisplaySnapshot,
} from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";
import {
  type CatalogLotRow,
  computeLotQueue,
  parseDisplayLotEstimate,
} from "./display-snapshot-reader.helpers.js";
import type { IDisplaySnapshotReader } from "./interfaces/display-snapshot-reader.js";

const DISPLAY_RECENT_BID_LIMIT = 10;

export type DisplaySnapshotReaderOptions = {
  db: Database;
  mediaUrlResolver: MediaUrlResolver;
};

async function resolveFirstImageUrl(
  images: string[] | null | undefined,
  mediaUrlResolver: MediaUrlResolver,
): Promise<string | null> {
  const firstImageKey = images?.[0] ?? null;
  if (!firstImageKey) {
    return null;
  }
  return mediaUrlResolver.resolve(firstImageKey);
}

async function buildNextLotPreview(
  row: CatalogLotRow,
  mediaUrlResolver: MediaUrlResolver,
): Promise<SaleroomDisplayNextLot> {
  return {
    lotNumber: row.lotNumber ?? 0,
    title: row.title,
    imageUrl: await resolveFirstImageUrl(row.images, mediaUrlResolver),
    estimate: parseDisplayLotEstimate(row.marketingDetails),
  };
}

export class DisplaySnapshotReader implements IDisplaySnapshotReader {
  private readonly db: Database;
  private readonly mediaUrlResolver: MediaUrlResolver;

  constructor(opts: DisplaySnapshotReaderOptions) {
    this.db = opts.db;
    this.mediaUrlResolver = opts.mediaUrlResolver;
  }

  async getSnapshot(saleId: string): Promise<SaleroomDisplaySnapshot | null> {
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
    if (!saleRow || !isSaleroomDeliveryMode(saleRow.deliveryMode)) {
      return null;
    }

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

    const sessionStatus = session?.status ?? "none";
    const currentLotId = session?.currentLotId ?? null;
    const overlay = (session?.displayOverlay as SaleroomDisplayOverlay | null) ?? null;
    const sessionStartedAt =
      session?.startedAt && (sessionStatus === "live" || sessionStatus === "paused")
        ? session.startedAt.toISOString()
        : null;

    let currentLot: SaleroomDisplaySnapshot["currentLot"] = null;
    if (currentLotId) {
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

        const recentBidRows = await this.db
          .select({
            id: bid.id,
            amount: bid.amount,
            placedVia: bid.placedVia,
            isAutoBid: bid.isAutoBid,
            createdAt: bid.createdAt,
          })
          .from(bid)
          .where(eq(bid.lotId, currentLotId))
          .orderBy(desc(bid.createdAt))
          .limit(DISPLAY_RECENT_BID_LIMIT);

        const imageUrl = await resolveFirstImageUrl(lotRow.images, this.mediaUrlResolver);

        currentLot = {
          id: lotRow.id,
          lotNumber: lotRow.lotNumber ?? 0,
          title: lotRow.title,
          imageUrl,
          currentPrice: String(lotRow.currentPrice),
          bidCount: countRow?.count ?? 0,
          leaderPaddleNumber,
          estimate: parseDisplayLotEstimate(lotRow.marketingDetails),
          minBidIncrement: String(lotRow.minBidIncrement ?? "1.00"),
          recentBids: recentBidRows.map((r) => ({
            id: r.id,
            amount: String(r.amount),
            placedVia: r.placedVia ?? null,
            isAutoBid: r.isAutoBid === true,
            at: r.createdAt.toISOString(),
          })),
        };
      }
    }

    let nextLot: SaleroomDisplayNextLot | null = null;
    let saleProgress: SaleroomDisplaySnapshot["saleProgress"] = null;
    let saleCoverImageUrl: string | null = null;

    try {
      if (sessionStatus === "live") {
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
            and(
              eq(lot.saleId, saleId),
              lotNotDeleted(),
              inArray(lot.status, ["scheduled", "active"]),
            ),
          )
          .orderBy(sql`${lot.lotNumber} asc nulls last`);

        const { saleProgress: progress, nextLotRow } = computeLotQueue(
          catalogRows as CatalogLotRow[],
          currentLotId,
        );
        saleProgress = progress;
        if (nextLotRow) {
          nextLot = await buildNextLotPreview(nextLotRow, this.mediaUrlResolver);
        }
      }

      if (!currentLotId) {
        saleCoverImageUrl = await resolveFirstImageUrl(saleRow.coverImages, this.mediaUrlResolver);
      }
    } catch (error) {
      console.error("[DisplaySnapshotReader] failed to load display extras", {
        saleId,
        error,
      });
    }

    return {
      saleId,
      saleTitle: saleRow.title,
      sessionStatus: session ? sessionStatus : "none",
      currentLotId,
      currentLot,
      nextLot,
      saleProgress,
      saleCoverImageUrl,
      sessionStartedAt,
      overlay,
    };
  }
}
