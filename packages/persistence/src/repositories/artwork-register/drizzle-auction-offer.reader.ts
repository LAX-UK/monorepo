import type { Database } from "@auction/db";
import { lot, sale } from "@auction/db/schema";
import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import type {
  AuctionOfferDraftLot,
  AuctionOfferDraftLotSummary,
  AuctionOfferLotCatalogue,
  AuctionOfferSale,
  IAuctionOfferReader,
} from "../../interfaces/artwork-register.js";

/** Lots in these states still hold the artwork's place in LAX Bid. */
const OPEN_LOT_STATUSES = ["draft", "scheduled", "active"] as const;

export class DrizzleAuctionOfferReader implements IAuctionOfferReader {
  constructor(private readonly db: Database) {}

  async listSalesOpenForOffer(now: Date): Promise<AuctionOfferSale[]> {
    const rows = await this.db
      .select({ id: sale.id, title: sale.title, startsAt: sale.startTime, endsAt: sale.endTime })
      .from(sale)
      .where(and(eq(sale.status, "draft"), isNull(sale.deletedAt), gt(sale.startTime, now)))
      .orderBy(asc(sale.startTime), asc(sale.id))
      .limit(100);
    return rows;
  }

  async findOpenLotForRegister(registerId: string): Promise<AuctionOfferDraftLot | null> {
    const [row] = await this.db
      .select({ lotId: lot.id, saleId: lot.saleId, status: lot.status })
      .from(lot)
      .where(
        and(
          eq(lot.artworkRegisterId, registerId),
          isNull(lot.deletedAt),
          inArray(lot.status, [...OPEN_LOT_STATUSES]),
        ),
      )
      .orderBy(asc(lot.createdAt))
      .limit(1);
    return row ?? null;
  }

  async findDraftLotForRegister(registerId: string): Promise<AuctionOfferDraftLotSummary | null> {
    const [row] = await this.db
      .select({ lotId: lot.id, saleId: lot.saleId, saleTitle: sale.title })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(eq(lot.artworkRegisterId, registerId), isNull(lot.deletedAt), eq(lot.status, "draft")),
      )
      .orderBy(asc(lot.createdAt))
      .limit(1);
    return row ?? null;
  }

  async findLotCatalogueForRegister(registerId: string): Promise<AuctionOfferLotCatalogue | null> {
    const [row] = await this.db
      .select({
        lotId: lot.id,
        status: lot.status,
        saleStatus: sale.status,
        title: lot.title,
        medium: lot.medium,
        dimensions: lot.dimensions,
        images: lot.images,
      })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          eq(lot.artworkRegisterId, registerId),
          isNull(lot.deletedAt),
          inArray(lot.status, [...OPEN_LOT_STATUSES]),
        ),
      )
      .orderBy(asc(lot.createdAt))
      .limit(1);
    return row ?? null;
  }
}
