import {
  type CurrentLocation,
  type LocationMove,
  type LocationRef,
  type StockLocation,
  nextMoveTime,
  planLocationMove,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  domainEvent,
  artworkLocation as location,
  artworkLocationMove as move,
  artworkRegister as register,
} from "@auction/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  AddLocationInput,
  IStockLocationStore,
  LocationWriteResult,
  MoveArtworksInput,
  MoveArtworksResult,
  SetLocationStatusInput,
  UpdateLocationInput,
} from "../../interfaces/artwork-location.js";
import { isPgUniqueViolation } from "../../lib/pg-unique-violation.js";
import { appendRegisterEvent } from "./register-event-writer.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const NAME_TAKEN: LocationWriteResult = { ok: false, reason: "name_taken" };

function toLocation(row: typeof location.$inferSelect): StockLocation {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    retiredAt: row.retiredAt,
  };
}

/** The latest move per artwork. Moves of one artwork never share a time (unique index). */
type LatestMove = { registerId: string; locationId: string; movedAt: Date; movedBy: string };

export class DrizzleStockLocationStore implements IStockLocationStore {
  constructor(private readonly db: Database) {}

  async listLocations(options?: { includeRetired?: boolean }): Promise<StockLocation[]> {
    const rows = await this.db
      .select()
      .from(location)
      .where(options?.includeRetired ? undefined : eq(location.status, "active"))
      .orderBy(asc(location.status), sql`lower(${location.name})`, asc(location.id));
    return rows.map(toLocation);
  }

  async findLocation(id: string): Promise<StockLocation | null> {
    const [row] = await this.db.select().from(location).where(eq(location.id, id)).limit(1);
    return row ? toLocation(row) : null;
  }

  async currentLocation(registerId: string): Promise<CurrentLocation | null> {
    return (await this.currentLocations([registerId])).get(registerId) ?? null;
  }

  async currentLocations(registerIds: readonly string[]): Promise<Map<string, CurrentLocation>> {
    const ids = [...new Set(registerIds)];
    const result = new Map<string, CurrentLocation>();
    if (ids.length === 0) return result;
    const rows = await this.db
      .selectDistinctOn([move.registerId], {
        registerId: move.registerId,
        movedAt: move.movedAt,
        movedBy: move.movedBy,
        id: location.id,
        name: location.name,
        status: location.status,
      })
      .from(move)
      .innerJoin(location, eq(location.id, move.locationId))
      .where(inArray(move.registerId, ids))
      .orderBy(move.registerId, desc(move.movedAt));
    for (const row of rows) {
      result.set(row.registerId, {
        location: { id: row.id, name: row.name, status: row.status },
        movedAt: row.movedAt,
        movedBy: row.movedBy,
      });
    }
    return result;
  }

  async listMoves(registerId: string, limit: number): Promise<LocationMove[]> {
    // Where each move came from is the move before it, so the window runs over all of the
    // artwork's moves before the newest `limit` are kept.
    const rows = await this.db.execute<{
      id: string;
      register_id: string;
      moved_at: Date | string;
      moved_by: string;
      note: string | null;
      to_id: string;
      to_name: string;
      to_status: LocationRef["status"];
      from_id: string | null;
      from_name: string | null;
      from_status: LocationRef["status"] | null;
    }>(sql`
      WITH ordered AS (
        SELECT m.id, m.register_id, m.location_id, m.moved_at, m.moved_by, m.note,
               lag(m.location_id) OVER (ORDER BY m.moved_at, m.id) AS from_location_id
          FROM ${move} m
         WHERE m.register_id = ${registerId}
      )
      SELECT o.id, o.register_id, o.moved_at, o.moved_by, o.note,
             t.id AS to_id, t.name AS to_name, t.status AS to_status,
             f.id AS from_id, f.name AS from_name, f.status AS from_status
        FROM ordered o
        JOIN ${location} t ON t.id = o.location_id
        LEFT JOIN ${location} f ON f.id = o.from_location_id
       ORDER BY o.moved_at DESC, o.id DESC
       LIMIT ${limit}
    `);
    return rows.rows.map((row) => ({
      id: row.id,
      registerId: row.register_id,
      from:
        row.from_id && row.from_name && row.from_status
          ? { id: row.from_id, name: row.from_name, status: row.from_status }
          : null,
      to: { id: row.to_id, name: row.to_name, status: row.to_status },
      movedAt: new Date(row.moved_at),
      movedBy: row.moved_by,
      note: row.note,
    }));
  }

  async addLocation(input: AddLocationInput): Promise<LocationWriteResult> {
    try {
      const [row] = await this.db
        .insert(location)
        .values({
          name: input.name,
          note: input.note,
          createdBy: input.actor,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();
      if (!row) throw new Error("artwork_location insert returned no row");
      return { ok: true, location: toLocation(row) };
    } catch (error) {
      if (isPgUniqueViolation(error)) return NAME_TAKEN;
      throw error;
    }
  }

  async updateLocation(input: UpdateLocationInput): Promise<LocationWriteResult> {
    try {
      return await this.writeVersioned(input.id, input.expectedVersion, {
        name: input.name,
        note: input.note,
        updatedAt: input.now,
      });
    } catch (error) {
      if (isPgUniqueViolation(error)) return NAME_TAKEN;
      throw error;
    }
  }

  async setLocationStatus(input: SetLocationStatusInput): Promise<LocationWriteResult> {
    return this.writeVersioned(input.id, input.expectedVersion, {
      status: input.status,
      retiredAt: input.status === "retired" ? input.now : null,
      updatedAt: input.now,
    });
  }

  async moveArtworks(input: MoveArtworksInput): Promise<MoveArtworksResult> {
    const ids = [...new Set(input.registerIds)].sort();
    return this.db.transaction(async (tx) => {
      // A share lock keeps the location from being retired while artworks move into it.
      const [target] = await tx
        .select({ id: location.id, status: location.status })
        .from(location)
        .where(eq(location.id, input.locationId))
        .for("share");
      const refusal = planLocationMove({ target: target ?? null, currentLocationId: null });
      if (!refusal.ok) return refusal;

      // Locked in id order, so two overlapping selections cannot deadlock, and two moves of the
      // same artwork take turns: each reads the other's move as the current location.
      const artworks =
        ids.length === 0
          ? []
          : await tx
              .select({
                id: register.id,
                zohoProductId: register.zohoProductId,
                stockCode: register.stockCode,
              })
              .from(register)
              .where(inArray(register.id, ids))
              .orderBy(asc(register.id))
              .for("no key update");
      const found = new Set(artworks.map((artwork) => artwork.id));
      const latest = await this.latestMoves(
        tx,
        artworks.map((artwork) => artwork.id),
      );

      const moved: { registerId: string; fromLocationId: string | null }[] = [];
      const unchanged: string[] = [];
      for (const artwork of artworks) {
        const previous = latest.get(artwork.id) ?? null;
        const plan = planLocationMove({
          target: target ?? null,
          currentLocationId: previous?.locationId ?? null,
        });
        if (!plan.ok) return plan;
        if (!plan.changes) {
          unchanged.push(artwork.id);
          continue;
        }
        await this.recordMove(tx, input, artwork, previous);
        moved.push({ registerId: artwork.id, fromLocationId: previous?.locationId ?? null });
      }
      return { ok: true, moved, unchanged, notFound: ids.filter((id) => !found.has(id)) };
    });
  }

  private async recordMove(
    tx: Tx,
    input: MoveArtworksInput,
    artwork: { id: string; zohoProductId: string; stockCode: string },
    previous: LatestMove | null,
  ): Promise<void> {
    const movedAt = nextMoveTime(input.now, previous?.movedAt ?? null);
    const [row] = await tx
      .insert(move)
      .values({
        registerId: artwork.id,
        locationId: input.locationId,
        movedAt,
        movedBy: input.actor,
        note: input.note,
      })
      .returning({ id: move.id });
    if (!row) throw new Error("artwork_location_move insert returned no row");
    const fromLocationId = previous?.locationId ?? null;
    // Ids only: names are read from the list, so a rename reads through and no note is copied.
    await appendRegisterEvent(tx, {
      registerId: artwork.id,
      type: "location_moved",
      actor: input.actor,
      now: movedAt,
      payload: { moveId: row.id, fromLocationId, toLocationId: input.locationId },
    });
    await tx.insert(domainEvent).values({
      aggregateType: "artwork_register",
      aggregateId: artwork.id,
      eventType: "artwork_register.location_changed",
      producer: "packages/db",
      payload: {
        schemaVersion: 1,
        registerId: artwork.id,
        zohoProductId: artwork.zohoProductId,
        stockCode: artwork.stockCode,
        fromLocationId,
        toLocationId: input.locationId,
      },
      schemaVersion: 1,
    });
  }

  private async latestMoves(
    tx: Tx,
    registerIds: readonly string[],
  ): Promise<Map<string, LatestMove>> {
    if (registerIds.length === 0) return new Map();
    const rows = await tx
      .selectDistinctOn([move.registerId], {
        registerId: move.registerId,
        locationId: move.locationId,
        movedAt: move.movedAt,
        movedBy: move.movedBy,
      })
      .from(move)
      .where(inArray(move.registerId, [...registerIds]))
      .orderBy(move.registerId, desc(move.movedAt));
    return new Map(rows.map((row) => [row.registerId, row]));
  }

  /** Writes when the version still matches; otherwise says whether the location is gone or moved on. */
  private async writeVersioned(
    id: string,
    expectedVersion: number,
    values: Partial<typeof location.$inferInsert>,
  ): Promise<LocationWriteResult> {
    const [row] = await this.db
      .update(location)
      .set({ ...values, version: sql`${location.version} + 1` })
      .where(and(eq(location.id, id), eq(location.version, expectedVersion)))
      .returning();
    if (row) return { ok: true, location: toLocation(row) };
    const exists = await this.findLocation(id);
    return { ok: false, reason: exists ? "stale" : "not_found" };
  }
}
