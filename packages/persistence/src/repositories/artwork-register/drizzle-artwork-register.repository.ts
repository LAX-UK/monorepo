import {
  type ArtworkRegisterEntry,
  type FieldConflict,
  type NewArtworkRegisterEntry,
  type RegisterField,
  type ZohoChange,
  reconcileZohoChange,
  transitionOffer,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  artworkRegisterConflict as conflict,
  artworkRegisterEvent as event,
  artworkRegister as register,
} from "@auction/db/schema";
import { and, asc, desc, eq, gt, like, or, sql } from "drizzle-orm";
import type {
  ApplyZohoChangeResult,
  ConflictCursor,
  CreateRegisterEntryResult,
  IArtworkRegisterRepository,
  MoveOfferInput,
  MoveOfferResult,
  RegisterActor,
  RegisterConflict,
  RegisterEvent,
  RegisterEventType,
  ResolveConflictInput,
  ResolveConflictResult,
} from "../../interfaces/artwork-register.js";
import { columnsForZohoFields, toConflict, toEntry, toEvent } from "./artwork-register.mapper.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class DrizzleArtworkRegisterRepository implements IArtworkRegisterRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<ArtworkRegisterEntry | null> {
    return this.findOne(eq(register.id, id));
  }

  async findByZohoProductId(zohoProductId: string): Promise<ArtworkRegisterEntry | null> {
    return this.findOne(eq(register.zohoProductId, zohoProductId));
  }

  async findByStockCode(stockCode: string): Promise<ArtworkRegisterEntry | null> {
    return this.findOne(eq(register.stockCode, stockCode));
  }

  async highestStockNumber(prefix: string): Promise<number | null> {
    const [row] = await this.db
      .select({ stockCode: register.stockCode })
      .from(register)
      .where(like(register.stockCode, `${escapeLike(prefix)}-%`))
      .orderBy(desc(register.stockCode))
      .limit(1);
    if (!row) return null;
    const number = Number(row.stockCode.slice(row.stockCode.lastIndexOf("-") + 1));
    return Number.isInteger(number) ? number : null;
  }

  async listEvents(registerId: string, limit: number): Promise<RegisterEvent[]> {
    const rows = await this.db
      .select()
      .from(event)
      .where(eq(event.registerId, registerId))
      .orderBy(asc(event.createdAt), asc(event.id))
      .limit(limit);
    return rows.map(toEvent);
  }

  async listOpenConflicts(limit: number, after?: ConflictCursor): Promise<RegisterConflict[]> {
    const rows = await this.db
      .select()
      .from(conflict)
      .where(
        and(
          eq(conflict.status, "open"),
          after
            ? or(
                gt(conflict.detectedAt, after.detectedAt),
                and(eq(conflict.detectedAt, after.detectedAt), gt(conflict.id, after.id)),
              )
            : undefined,
        ),
      )
      .orderBy(asc(conflict.detectedAt), asc(conflict.id))
      .limit(limit);
    return rows.map(toConflict);
  }

  async create(
    entry: NewArtworkRegisterEntry,
    actor: RegisterActor,
    now: Date,
  ): Promise<CreateRegisterEntryResult> {
    return this.db.transaction(async (tx) => {
      if (!(await this.sourceOriginalIsValid(tx, entry))) {
        return { ok: false, reason: "source_original_invalid" };
      }
      const [row] = await tx
        .insert(register)
        .values({
          zohoProductId: entry.zohoProductId,
          stockCode: entry.stockCode,
          kind: entry.kind,
          sourceOriginalId: entry.sourceOriginalId,
          title: entry.title,
          artistZohoId: entry.artist.zohoArtistId,
          artistName: entry.artist.name,
          artistCode: entry.artist.code,
          medium: entry.medium,
          dimensions: entry.dimensions,
          year: entry.year,
          imageRefs: entry.imageRefs,
          catalogueStatus: entry.catalogueStatus,
          zohoModifiedAt: entry.zohoModifiedAt ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
      if (!row) {
        const [byProduct] = await tx
          .select({ id: register.id })
          .from(register)
          .where(eq(register.zohoProductId, entry.zohoProductId))
          .limit(1);
        return {
          ok: false,
          reason: byProduct ? "duplicate_zoho_product" : "duplicate_stock_code",
        };
      }
      await this.record(tx, row.id, "created", actor, now, {
        stockCode: row.stockCode,
        zohoProductId: row.zohoProductId,
      });
      return { ok: true, entry: toEntry(row) };
    });
  }

  async applyZohoChange(change: ZohoChange, now: Date): Promise<ApplyZohoChangeResult> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(register)
        .where(eq(register.zohoProductId, change.zohoProductId))
        .for("update");
      if (!locked) return { status: "not_found" };

      const current = toEntry(locked);
      const result = reconcileZohoChange(current, change);
      if (result.stale) return { status: "stale", entry: current };

      const applied = Object.keys(result.apply) as RegisterField[];
      const [row] = await tx
        .update(register)
        .set({
          ...columnsForZohoFields(result.apply),
          zohoModifiedAt: change.modifiedAt,
          updatedAt: now,
          version: applied.length > 0 ? sql`${register.version} + 1` : register.version,
        })
        .where(eq(register.id, locked.id))
        .returning();
      if (!row) return { status: "not_found" };

      if (applied.length > 0) {
        await this.record(tx, row.id, "zoho_change_applied", "zoho", now, {
          fields: Object.fromEntries(
            applied.map((field) => [
              field,
              { to: (result.apply as Record<string, unknown>)[field] },
            ]),
          ),
          zohoModifiedAt: change.modifiedAt.toISOString(),
        });
      }
      for (const found of result.conflicts) {
        await this.recordConflict(tx, row.id, found, change.modifiedAt, now);
      }
      return { status: "applied", entry: toEntry(row), applied, conflicts: result.conflicts };
    });
  }

  async moveOffer(input: MoveOfferInput): Promise<MoveOfferResult> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(register)
        .where(eq(register.id, input.registerId))
        .for("update");
      if (!locked) return { ok: false, reason: "not_found" };
      if (locked.version !== input.expectedVersion)
        return { ok: false, reason: "version_conflict" };

      const from = toEntry(locked).offer;
      const move = transitionOffer(from.state, input.to, input.ref);
      if (!move.ok) return { ok: false, reason: move.reason };

      const [row] = await tx
        .update(register)
        .set({
          offerState: move.state,
          offerRefKind: move.ref?.kind ?? null,
          offerRefId: move.ref?.id ?? null,
          updatedAt: input.now,
          version: sql`${register.version} + 1`,
        })
        .where(and(eq(register.id, locked.id), eq(register.version, input.expectedVersion)))
        .returning();
      if (!row) return { ok: false, reason: "version_conflict" };

      await this.record(tx, row.id, "offer_moved", input.actor, input.now, {
        from,
        to: { state: move.state, ref: move.ref },
      });
      return { ok: true, entry: toEntry(row) };
    });
  }

  async resolveConflict(input: ResolveConflictInput): Promise<ResolveConflictResult> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(conflict)
        .set({
          status: "resolved",
          resolution: input.resolution,
          resolvedBy: input.resolvedBy,
          resolvedAt: input.now,
        })
        .where(and(eq(conflict.id, input.conflictId), eq(conflict.status, "open")))
        .returning();
      if (!row) {
        const [existing] = await tx
          .select({ id: conflict.id })
          .from(conflict)
          .where(eq(conflict.id, input.conflictId))
          .limit(1);
        return { ok: false, reason: existing ? "already_resolved" : "not_found" };
      }
      await this.record(tx, row.registerId, "conflict_resolved", input.resolvedBy, input.now, {
        conflictId: row.id,
        field: row.field,
        resolution: input.resolution,
      });
      return { ok: true, conflict: toConflict(row) };
    });
  }

  private async findOne(where: ReturnType<typeof eq>): Promise<ArtworkRegisterEntry | null> {
    const [row] = await this.db.select().from(register).where(where).limit(1);
    return row ? toEntry(row) : null;
  }

  /** A print needs an original in the register to come from; an original has no source. */
  private async sourceOriginalIsValid(tx: Tx, entry: NewArtworkRegisterEntry): Promise<boolean> {
    if (entry.sourceOriginalId === null) return true;
    if (entry.kind !== "print") return false;
    const [source] = await tx
      .select({ kind: register.kind })
      .from(register)
      .where(eq(register.id, entry.sourceOriginalId))
      .limit(1);
    return source?.kind === "original";
  }

  private async recordConflict(
    tx: Tx,
    registerId: string,
    found: FieldConflict,
    zohoModifiedAt: Date,
    now: Date,
  ): Promise<void> {
    await tx
      .insert(conflict)
      .values({
        registerId,
        field: found.field,
        zohoValue: found.zohoValue,
        laxValue: found.laxValue,
        zohoModifiedAt,
        detectedAt: now,
      })
      .onConflictDoUpdate({
        target: [conflict.registerId, conflict.field],
        targetWhere: eq(conflict.status, "open"),
        set: {
          zohoValue: found.zohoValue,
          laxValue: found.laxValue,
          zohoModifiedAt,
        },
      });
    await this.record(tx, registerId, "conflict_recorded", "zoho", now, {
      field: found.field,
      zohoValue: found.zohoValue,
      laxValue: found.laxValue,
    });
  }

  private async record(
    tx: Tx,
    registerId: string,
    type: RegisterEventType,
    actor: RegisterActor,
    now: Date,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await tx.insert(event).values({ registerId, type, actor, payload, createdAt: now });
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
