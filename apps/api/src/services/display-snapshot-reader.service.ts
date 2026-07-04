import type { ISaleroomDisplaySnapshotReader } from "@auction/persistence/interfaces";
import type { SaleroomDisplayNextLot, SaleroomDisplaySnapshot } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";
import {
  type CatalogLotRow,
  computeLotQueue,
  parseDisplayLotEstimate,
} from "./display-snapshot-reader.helpers.js";
import type { IDisplaySnapshotReader } from "./interfaces/display-snapshot-reader.js";

const DISPLAY_RECENT_BID_LIMIT = 10;

export type DisplaySnapshotReaderOptions = {
  reader: ISaleroomDisplaySnapshotReader;
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
  private readonly reader: ISaleroomDisplaySnapshotReader;
  private readonly mediaUrlResolver: MediaUrlResolver;

  constructor(opts: DisplaySnapshotReaderOptions) {
    this.reader = opts.reader;
    this.mediaUrlResolver = opts.mediaUrlResolver;
  }

  async getSnapshot(saleId: string): Promise<SaleroomDisplaySnapshot | null> {
    const saleRow = await this.reader.findSale(saleId);
    if (
      !saleRow ||
      !isSaleroomDeliveryMode(saleRow.deliveryMode as "online" | "onsite" | "hybrid")
    ) {
      return null;
    }

    const session = await this.reader.findSession(saleId);

    const sessionStatus = session?.status ?? "none";
    const currentLotId = session?.currentLotId ?? null;
    const overlay = session?.displayOverlay ?? null;
    const sessionStartedAt =
      session?.startedAt && (sessionStatus === "live" || sessionStatus === "paused")
        ? session.startedAt.toISOString()
        : null;

    let currentLot: SaleroomDisplaySnapshot["currentLot"] = null;
    if (currentLotId) {
      const lotRow = await this.reader.findCurrentLot(currentLotId);

      if (lotRow) {
        const bidCount = await this.reader.countBidsForLot(currentLotId);
        const winnerBidderId = await this.reader.findWinningBidderId(currentLotId);

        let leaderPaddleNumber: number | null = null;
        if (winnerBidderId) {
          leaderPaddleNumber = await this.reader.findCheckedInPaddleNumber(saleId, winnerBidderId);
        }

        const recentBidRows = await this.reader.listRecentBids(
          currentLotId,
          DISPLAY_RECENT_BID_LIMIT,
        );

        const imageUrl = await resolveFirstImageUrl(lotRow.images, this.mediaUrlResolver);

        currentLot = {
          id: lotRow.id,
          lotNumber: lotRow.lotNumber ?? 0,
          title: lotRow.title,
          imageUrl,
          currentPrice: lotRow.currentPrice,
          bidCount,
          leaderPaddleNumber,
          estimate: parseDisplayLotEstimate(lotRow.marketingDetails),
          minBidIncrement: String(lotRow.minBidIncrement ?? "1.00"),
          recentBids: recentBidRows.map((r) => ({
            id: r.id,
            amount: r.amount,
            placedVia: r.placedVia,
            isAutoBid: r.isAutoBid,
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
        const catalogRows = await this.reader.listCatalogLots(saleId);

        const { saleProgress: progress, nextLotRow } = computeLotQueue(catalogRows, currentLotId);
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
      sessionStatus: session ? (sessionStatus as SaleroomDisplaySnapshot["sessionStatus"]) : "none",
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
