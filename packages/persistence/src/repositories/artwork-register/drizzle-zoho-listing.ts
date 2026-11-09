import type { OfferState } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  domainEventDelivery,
  lot,
  privateSaleDeal,
  artworkRegister as register,
  artworkRegisterEvent as registerEvent,
  sale,
  zohoListingSyncRun,
} from "@auction/db/schema";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type {
  IZohoListingLock,
  IZohoListingRunReader,
  IZohoListingRunStore,
  IZohoListingSourceReader,
  ListingLot,
  ListingMove,
  RegisterListingSource,
  ZohoListingRun,
} from "../../interfaces/zoho-listing.js";
import { toEntry } from "./artwork-register.mapper.js";

const OPEN_LOT_STATUSES = ["draft", "scheduled", "active"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The delivery consumers that write to Zoho Products for the register. */
const PRODUCT_WRITE_CONSUMERS = ["zoho_artwork_writeback", "zoho_artwork_listing"];

function stateOf(value: unknown): OfferState | null {
  const state = value && typeof value === "object" ? (value as { state?: unknown }).state : null;
  return typeof state === "string" ? (state as OfferState) : null;
}

type LotRow = {
  id: string;
  registerId: string | null;
  title: string;
  lotNumber: number | null;
  status: ListingLot["status"];
  deletedAt: Date | null;
  saleId: string | null;
  saleTitle: string | null;
  saleStatus: NonNullable<ListingLot["sale"]>["status"] | null;
  saleStart: Date | null;
  saleEnd: Date | null;
  saleIsTest: boolean | null;
};

function toLot(row: LotRow): ListingLot {
  const hasSale =
    row.saleId !== null &&
    row.saleTitle !== null &&
    row.saleStatus !== null &&
    row.saleStart !== null &&
    row.saleEnd !== null;
  return {
    id: row.id,
    title: row.title,
    lotNumber: row.lotNumber,
    status: row.status,
    deleted: row.deletedAt !== null,
    sale: hasSale
      ? {
          id: row.saleId as string,
          title: row.saleTitle as string,
          status: row.saleStatus as NonNullable<ListingLot["sale"]>["status"],
          startTime: row.saleStart as Date,
          endTime: row.saleEnd as Date,
          isTest: row.saleIsTest === true,
        }
      : null,
  };
}

/** Register, LAX Bid lot and sale, and private sale reads for the LAX listing on Zoho. */
export class DrizzleZohoListingSourceReader implements IZohoListingSourceReader {
  constructor(private readonly db: Database) {}

  async read(registerIds: readonly string[]): Promise<RegisterListingSource[]> {
    const ids = [...new Set(registerIds)].filter((id) => UUID.test(id));
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(register)
      .where(and(inArray(register.id, ids), eq(register.kind, "original")));
    if (rows.length === 0) return [];
    const entries = rows.map(toEntry);
    const found = entries.map((entry) => entry.id);

    const [moves, lots, deals] = await Promise.all([
      this.latestMoves(found),
      this.lotsFor(entries),
      this.dealsFor(entries),
    ]);
    return entries.map((entry) => ({
      entry,
      lastMove: moves.get(entry.id) ?? null,
      lot: lots.get(entry.id) ?? null,
      privateSale: deals.get(entry.id) ?? null,
    }));
  }

  async registerIdsForLot(lotId: string): Promise<string[]> {
    if (!UUID.test(lotId)) return [];
    const rows = await this.db
      .select({ registerId: lot.artworkRegisterId })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    return rows.flatMap((row) => (row.registerId ? [row.registerId] : []));
  }

  async registerIdsForSale(saleId: string): Promise<string[]> {
    if (!UUID.test(saleId)) return [];
    const rows = await this.db
      .selectDistinct({ registerId: lot.artworkRegisterId })
      .from(lot)
      .where(and(eq(lot.saleId, saleId), sql`${lot.artworkRegisterId} IS NOT NULL`));
    return rows.flatMap((row) => (row.registerId ? [row.registerId] : []));
  }

  async registerIdsForSalesStartedBetween(
    window: { from: Date; to: Date },
    after: string | null,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ registerId: lot.artworkRegisterId })
      .from(lot)
      .innerJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          eq(sale.status, "scheduled"),
          isNull(sale.deletedAt),
          isNull(lot.deletedAt),
          gt(sale.startTime, window.from),
          lte(sale.startTime, window.to),
          sql`${lot.artworkRegisterId} IS NOT NULL`,
          after ? gt(lot.artworkRegisterId, after) : sql`TRUE`,
        ),
      )
      .orderBy(asc(lot.artworkRegisterId))
      .limit(limit);
    return rows.flatMap((row) => (row.registerId ? [row.registerId] : []));
  }

  async registerIdsForLaxArtListing(artworkId: string): Promise<string[]> {
    if (!UUID.test(artworkId)) return [];
    // Offered through the listing, or the listing was drafted from the record.
    const rows = await this.db
      .selectDistinct({ registerId: register.id })
      .from(register)
      .leftJoin(
        registerEvent,
        and(
          eq(registerEvent.registerId, register.id),
          eq(registerEvent.type, "lax_art_draft_created"),
        ),
      )
      .where(
        or(
          and(eq(register.offerRefKind, "shop_artwork"), eq(register.offerRefId, artworkId)),
          sql`${registerEvent.payload}->>'artworkId' = ${artworkId}`,
        ),
      );
    return rows.map((row) => row.registerId);
  }

  async pageOriginals(after: string | null, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: register.id })
      .from(register)
      .where(and(eq(register.kind, "original"), after ? gt(register.id, after) : sql`TRUE`))
      .orderBy(asc(register.id))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  /** The newest offer move per record. */
  private async latestMoves(ids: string[]): Promise<Map<string, ListingMove>> {
    const rows = await this.db
      .selectDistinctOn([registerEvent.registerId], {
        registerId: registerEvent.registerId,
        payload: registerEvent.payload,
        createdAt: registerEvent.createdAt,
      })
      .from(registerEvent)
      .where(and(inArray(registerEvent.registerId, ids), eq(registerEvent.type, "offer_moved")))
      .orderBy(registerEvent.registerId, desc(registerEvent.createdAt), desc(registerEvent.id));
    const moves = new Map<string, ListingMove>();
    for (const row of rows) {
      const to = stateOf(row.payload.to);
      if (to) moves.set(row.registerId, { at: row.createdAt, from: stateOf(row.payload.from), to });
    }
    return moves;
  }

  /**
   * The lot each record is offered in (its reference, kept after the sale), or else its open lot,
   * which for a record not yet offered is the draft lot staff are preparing.
   */
  private async lotsFor(
    entries: RegisterListingSource["entry"][],
  ): Promise<Map<string, ListingLot>> {
    const byRef = new Map<string, string>();
    for (const entry of entries) {
      const ref = entry.offer.ref;
      if (ref?.kind === "bid_lot" && UUID.test(ref.id)) byRef.set(ref.id, entry.id);
    }
    const ids = entries.map((entry) => entry.id);
    const refIds = [...byRef.keys()];
    const rows: LotRow[] = await this.db
      .select({
        id: lot.id,
        registerId: lot.artworkRegisterId,
        title: lot.title,
        lotNumber: lot.lotNumber,
        status: lot.status,
        deletedAt: lot.deletedAt,
        saleId: sale.id,
        saleTitle: sale.title,
        saleStatus: sale.status,
        saleStart: sale.startTime,
        saleEnd: sale.endTime,
        saleIsTest: sale.isTest,
      })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(
        or(
          refIds.length > 0 ? inArray(lot.id, refIds) : sql`FALSE`,
          and(
            inArray(lot.artworkRegisterId, ids),
            isNull(lot.deletedAt),
            inArray(lot.status, [...OPEN_LOT_STATUSES]),
          ),
        ),
      );
    const lots = new Map<string, ListingLot>();
    // The referenced lot wins over an open one.
    for (const row of rows) {
      const viaRef = byRef.get(row.id);
      if (viaRef) lots.set(viaRef, toLot(row));
    }
    for (const row of rows) {
      if (row.registerId && !lots.has(row.registerId) && !byRef.has(row.id)) {
        lots.set(row.registerId, toLot(row));
      }
    }
    return lots;
  }

  private async dealsFor(
    entries: RegisterListingSource["entry"][],
  ): Promise<Map<string, { id: string; reference: string }>> {
    const byDeal = new Map<string, string>();
    for (const entry of entries) {
      const ref = entry.offer.ref;
      if (ref?.kind === "private_sale" && UUID.test(ref.id)) byDeal.set(ref.id, entry.id);
    }
    if (byDeal.size === 0) return new Map();
    const rows = await this.db
      .select({ id: privateSaleDeal.id, reference: privateSaleDeal.reference })
      .from(privateSaleDeal)
      .where(inArray(privateSaleDeal.id, [...byDeal.keys()]));
    const deals = new Map<string, { id: string; reference: string }>();
    for (const row of rows) {
      const registerId = byDeal.get(row.id);
      if (registerId) deals.set(registerId, row);
    }
    return deals;
  }
}

/**
 * Per-artwork transaction-scoped advisory locks, taken in id order so two holders of overlapping
 * sets can never deadlock. The transaction writes nothing; it only holds the locks.
 */
export class DrizzleZohoListingLock implements IZohoListingLock {
  constructor(private readonly db: Database) {}

  async withLock<T>(registerIds: readonly string[], fn: () => Promise<T>): Promise<T> {
    const ids = [...new Set(registerIds)].sort();
    return this.db.transaction(async (tx) => {
      for (const id of ids) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`zoho_listing:${id}`}))`);
      }
      return fn();
    });
  }
}

/** The nightly listing pass's summaries, and what LAX Admin reads of them. */
export class DrizzleZohoListingRunStore implements IZohoListingRunStore, IZohoListingRunReader {
  constructor(private readonly db: Database) {}

  async record(run: ZohoListingRun): Promise<void> {
    const values = {
      mode: run.mode,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      checked: run.checked,
      changed: run.changed,
      unchanged: run.unchanged,
      failed: run.failed,
      failures: run.failures,
    };
    await this.db
      .insert(zohoListingSyncRun)
      .values({ runId: run.runId, ...values })
      .onConflictDoUpdate({ target: zohoListingSyncRun.runId, set: values });
  }

  async latestRun(): Promise<ZohoListingRun | null> {
    const [row] = await this.db
      .select()
      .from(zohoListingSyncRun)
      .orderBy(desc(zohoListingSyncRun.finishedAt))
      .limit(1);
    return row ?? null;
  }

  async countFailedDeliveries(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(domainEventDelivery)
      .where(
        and(
          inArray(domainEventDelivery.consumer, PRODUCT_WRITE_CONSUMERS),
          eq(domainEventDelivery.status, "dead_lettered"),
        ),
      );
    return row?.count ?? 0;
  }
}
