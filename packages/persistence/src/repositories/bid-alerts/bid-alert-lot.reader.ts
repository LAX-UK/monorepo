import type { Database } from "@auction/db";
import { artistProfile, lot, sale } from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type {
  AlertableLot,
  IBidAlertLotReader,
  SearchWatcher,
} from "../../interfaces/bid-alert-lot.js";
import { listWhere } from "../lot/lot-list-filters.js";

/** A lot an alert may announce: on sale or scheduled, in a sale the public can see. */
const ALERTABLE_STATUSES = ["scheduled", "active"] as const;

const MONEY = /^\d+(\.\d{1,2})?$/;

function estimateOf(details: Record<string, unknown>): AlertableLot["estimate"] {
  const raw = details.estimate;
  if (!raw || typeof raw !== "object") return null;
  const { low, high, currency } = raw as Record<string, unknown>;
  if (
    typeof low !== "string" ||
    typeof high !== "string" ||
    !MONEY.test(low) ||
    !MONEY.test(high)
  ) {
    return null;
  }
  return { low, high, currency: typeof currency === "string" && currency ? currency : "GBP" };
}

/** Bid's reads for lot alerts: the lot behind an event, and what a saved search would show. */
export class BidAlertLotReader implements IBidAlertLotReader {
  constructor(private readonly db: Database) {}

  async findAlertable(lotIds: readonly string[]): Promise<AlertableLot[]> {
    if (lotIds.length === 0) return [];
    const rows = await this.db
      .select({
        id: lot.id,
        title: lot.title,
        medium: lot.medium,
        artistId: lot.artistId,
        artistName: artistProfile.displayName,
        saleTitle: sale.title,
        startingPrice: lot.startingPrice,
        marketingDetails: lot.marketingDetails,
      })
      .from(lot)
      .leftJoin(artistProfile, eq(artistProfile.id, lot.artistId))
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          inArray(lot.id, [...lotIds]),
          listWhere({ statuses: [...ALERTABLE_STATUSES], requirePublicParentSale: true }),
        ),
      );
    return rows.map((row) => {
      const estimate = estimateOf(row.marketingDetails ?? {});
      return {
        id: row.id,
        title: row.title,
        medium: row.medium,
        artistId: row.artistId,
        artistName: row.artistName,
        saleTitle: row.saleTitle,
        startingPrice: row.startingPrice,
        estimate,
        price: estimate?.low ?? row.startingPrice,
      };
    });
  }

  /**
   * The search page's own filter, narrowed to these lots, so an alert matches exactly what the
   * search would show. A search with neither text nor category would match everything and is
   * never alerted on.
   */
  async matchingSearch(
    query: SearchWatcher["query"],
    lotIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const q = query.q.trim();
    if (lotIds.length === 0 || (!q && !query.categoryId)) return new Set();
    const rows = await this.db
      .select({ id: lot.id })
      .from(lot)
      .where(
        and(
          inArray(lot.id, [...lotIds]),
          listWhere({
            statuses: [...ALERTABLE_STATUSES],
            requirePublicParentSale: true,
            ...(q ? { search: q } : {}),
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          }),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }
}
