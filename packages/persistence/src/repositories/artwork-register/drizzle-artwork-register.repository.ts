import {
  type ArtworkRegisterEntry,
  type FieldConflict,
  type NewArtworkRegisterEntry,
  type RegisterConflictField,
  type RegisterField,
  StockCodeError,
  type StockCodeKind,
  type StockCodeSeries,
  type ZohoChange,
  type ZohoImageSource,
  assertSeries,
  canAcceptZohoValue,
  imageKeysOf,
  nextStockCode,
  parseStockCode,
  printCodeForOriginal,
  reconcileZohoChange,
  sameImageSources,
  transitionOffer,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  artworkRegisterConflict as conflict,
  domainEvent,
  artworkRegisterEvent as event,
  artworkRegister as register,
} from "@auction/db/schema";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type {
  ApplyZohoChangeResult,
  CatalogueStatusLedger,
  ConflictCursor,
  CreateRegisterEntryResult,
  IArtworkDraftHistory,
  IArtworkImageStore,
  IArtworkLinkHistory,
  IArtworkMoveHistory,
  IArtworkRegisterRepository,
  ImageCheckCandidate,
  IssueRegisterEntry,
  IssueRegisterEntryResult,
  MoveOfferInput,
  MoveOfferResult,
  RecordCatalogueStatusConflictInput,
  RecordCatalogueStatusConflictResult,
  RecordCatalogueStatusWrittenInput,
  RecordCatalogueStatusWrittenResult,
  RecordLaxArtDraftCreatedInput,
  RecordMoveConfirmedInput,
  RecordZohoLinkInput,
  RegisterActor,
  RegisterConflict,
  RegisterEvent,
  RegisterEventType,
  ReplaceZohoImagesInput,
  ReplaceZohoImagesResult,
  ResolveConflictInput,
  ResolveConflictResult,
} from "../../interfaces/artwork-register.js";
import { columnsForZohoFields, toConflict, toEntry, toEvent } from "./artwork-register.mapper.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Built over a connection pool, every write opens its own transaction. Built over an open
 * transaction (the register shares the product's database), each write becomes a savepoint inside
 * it, so the move commits or rolls back with the caller's change; the row lock, version check and
 * history/event writes are unchanged.
 */
export class DrizzleArtworkRegisterRepository
  implements
    IArtworkRegisterRepository,
    IArtworkMoveHistory,
    IArtworkDraftHistory,
    IArtworkLinkHistory,
    IArtworkImageStore
{
  constructor(private readonly db: Database) {}

  /** The same repository over the caller's open transaction. */
  withExecutor(executor: Database): DrizzleArtworkRegisterRepository {
    return new DrizzleArtworkRegisterRepository(executor);
  }

  async findById(id: string): Promise<ArtworkRegisterEntry | null> {
    return this.findOne(eq(register.id, id));
  }

  async findByZohoProductId(zohoProductId: string): Promise<ArtworkRegisterEntry | null> {
    return this.findOne(eq(register.zohoProductId, zohoProductId));
  }

  async findByStockCode(stockCode: string): Promise<ArtworkRegisterEntry | null> {
    return this.findOne(eq(register.stockCode, stockCode));
  }

  async highestStockNumber(series: StockCodeSeries): Promise<number | null> {
    return this.highestNumber(this.db, series);
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
    return this.db.transaction((tx) => this.insertEntry(tx, entry, actor, now));
  }

  async issue(
    kind: StockCodeKind,
    entry: IssueRegisterEntry,
    actor: RegisterActor,
    now: Date,
  ): Promise<IssueRegisterEntryResult> {
    const series = { kind, artist: entry.artist.code, second: entry.collectionCode };
    try {
      assertSeries(series);
    } catch (error) {
      if (error instanceof StockCodeError) {
        return { ok: false, reason: "invalid_code", message: error.message };
      }
      throw error;
    }
    return this.db.transaction(async (tx) => {
      await this.lockSeries(tx, series);
      let stockCode: string;
      try {
        stockCode = nextStockCode(
          { ...series, year: registrationYear(now) },
          await this.highestNumber(tx, series),
        );
      } catch (error) {
        if (error instanceof StockCodeError) {
          return { ok: false, reason: "numbers_exhausted", message: error.message } as const;
        }
        throw error;
      }
      const { collectionCode: _collection, ...rest } = entry;
      return this.insertIssued(
        tx,
        { ...rest, stockCode, kind, sourceOriginalId: null },
        actor,
        now,
      );
    });
  }

  async issuePrintGroup(
    originalId: string,
    entry: Omit<IssueRegisterEntry, "collectionCode" | "artist">,
    actor: RegisterActor,
    now: Date,
  ): Promise<IssueRegisterEntryResult> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(register)
        .where(eq(register.id, originalId))
        .for("share");
      if (!original || original.kind !== "original") {
        return {
          ok: false,
          reason: "original_not_found",
          message: "The original this print group is made from was not found",
        } as const;
      }
      const stockCode = printCodeForOriginal(original.stockCode);
      const [holder] = await tx
        .select({ id: register.id, sourceOriginalId: register.sourceOriginalId })
        .from(register)
        .where(eq(register.stockCode, stockCode))
        .limit(1);
      if (holder) {
        const sameOriginal = holder.sourceOriginalId === originalId;
        return {
          ok: false,
          reason: sameOriginal ? "print_group_exists" : "print_code_taken_by_other_original",
          message: sameOriginal
            ? `${stockCode} already exists for this original`
            : `${stockCode} already belongs to a print of a different original`,
        } as const;
      }
      return this.insertIssued(
        tx,
        {
          ...entry,
          artist: {
            zohoArtistId: original.artistZohoId,
            name: original.artistName,
            code: original.artistCode,
          },
          stockCode,
          kind: "print",
          sourceOriginalId: originalId,
        },
        actor,
        now,
      );
    });
  }

  private async insertIssued(
    tx: Tx,
    entry: NewArtworkRegisterEntry,
    actor: RegisterActor,
    now: Date,
  ): Promise<IssueRegisterEntryResult> {
    const result = await this.insertEntry(tx, entry, actor, now);
    if (result.ok) return result;
    const duplicateProduct = result.reason === "duplicate_zoho_product";
    return {
      ok: false,
      reason: duplicateProduct ? "duplicate_zoho_product" : "invalid_code",
      message: duplicateProduct
        ? "This Zoho Product is already in the register"
        : `${entry.stockCode} could not be issued`,
    };
  }

  /** Serialises issuing for one kind, artist and collection until the transaction ends. */
  private async lockSeries(tx: Tx, series: StockCodeSeries): Promise<void> {
    const key = `stock-code:${series.kind}:${series.artist}:${series.second}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
  }

  private async highestNumber(
    executor: Pick<Database, "execute">,
    series: StockCodeSeries,
  ): Promise<number | null> {
    for (const part of [series.artist, series.second]) {
      if (!/^[A-Z0-9]{1,6}$/.test(part)) return null;
    }
    const segment = series.kind === "original" ? "ORI" : "(PRT|PRI)";
    const pattern = `^LAX-${segment}-${series.artist}-${series.second}-[0-9]{2}-[0-9]{4}$`;
    const result = await executor.execute(
      sql`SELECT max(substring(stock_code from '[0-9]{4}$')::int) AS highest
          FROM artwork_register WHERE stock_code ~ ${pattern}`,
    );
    const highest = (result.rows[0] as { highest: number | null } | undefined)?.highest;
    return highest === null || highest === undefined ? null : Number(highest);
  }

  private async insertEntry(
    tx: Tx,
    entry: NewArtworkRegisterEntry,
    actor: RegisterActor,
    now: Date,
  ): Promise<CreateRegisterEntryResult> {
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
    // A code that came from Zoho is already there; only one LAX issued needs sending.
    if (actor !== "zoho") {
      await this.publish(tx, row.id, "artwork_register.stock_code_assigned", {
        schemaVersion: 1,
        registerId: row.id,
        zohoProductId: row.zohoProductId,
        stockCode: row.stockCode,
      });
    }
    return { ok: true, entry: toEntry(row) };
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
      if (from.state !== move.state) {
        await this.publish(tx, row.id, "artwork_register.offer_changed", {
          schemaVersion: 1,
          registerId: row.id,
          zohoProductId: row.zohoProductId,
          stockCode: row.stockCode,
          fromState: from.state,
          toState: move.state,
        });
      }
      return { ok: true, entry: toEntry(row) };
    });
  }

  async resolveConflict(input: ResolveConflictInput): Promise<ResolveConflictResult> {
    return this.db.transaction(async (tx) => {
      const [open] = await tx
        .select()
        .from(conflict)
        .where(eq(conflict.id, input.conflictId))
        .for("update");
      if (!open) return { ok: false, reason: "not_found" };
      if (open.status !== "open") return { ok: false, reason: "already_resolved" };

      let applied: { field: string; from: string; to: string } | null = null;
      if (input.resolution === "accepted_zoho") {
        if (open.field === "catalogueStatus" || !canAcceptZohoValue(open.field))
          return { ok: false, reason: "cannot_accept_field" };
        const taken = await this.applyZohoStockCode(tx, open, input.now);
        if (!taken.ok) return taken;
        applied = taken.applied;
      }

      const [row] = await tx
        .update(conflict)
        .set({
          status: "resolved",
          resolution: input.resolution,
          resolvedBy: input.resolvedBy,
          resolvedAt: input.now,
        })
        .where(eq(conflict.id, open.id))
        .returning();
      if (!row) return { ok: false, reason: "already_resolved" };
      await this.record(tx, row.registerId, "conflict_resolved", input.resolvedBy, input.now, {
        conflictId: row.id,
        field: row.field,
        resolution: input.resolution,
        ...(applied ? { applied } : {}),
      });
      return { ok: true, conflict: toConflict(row) };
    });
  }

  async recordCatalogueStatusWritten(
    input: RecordCatalogueStatusWrittenInput,
  ): Promise<RecordCatalogueStatusWrittenResult> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(register)
        .where(eq(register.id, input.registerId))
        .for("update");
      if (!locked) return { status: "not_found" };
      await this.closeStatusConflict(tx, locked.id, input.now);
      if (locked.catalogueStatus === input.status) {
        if (locked.catalogueStatusWritten !== input.status) {
          await tx
            .update(register)
            .set({ catalogueStatusWritten: input.status })
            .where(eq(register.id, locked.id));
        }
        return { status: "unchanged" };
      }
      // The version stays put: this is a copy of what Zoho now shows, not a change to LAX's record.
      await tx
        .update(register)
        .set({
          catalogueStatus: input.status,
          catalogueStatusWritten: input.status,
          updatedAt: input.now,
        })
        .where(eq(register.id, locked.id));
      await this.record(tx, locked.id, "zoho_writeback_recorded", "system", input.now, {
        field: "catalogueStatus",
        from: locked.catalogueStatus,
        to: input.status,
      });
      return { status: "recorded" };
    });
  }

  async findCatalogueStatusLedgers(
    registerIds: readonly string[],
  ): Promise<Map<string, CatalogueStatusLedger>> {
    const ledgers = new Map<string, CatalogueStatusLedger>();
    if (registerIds.length === 0) return ledgers;
    const [rows, open] = await Promise.all([
      this.db
        .select({ id: register.id, written: register.catalogueStatusWritten })
        .from(register)
        .where(inArray(register.id, [...registerIds])),
      this.db
        .select({ registerId: conflict.registerId })
        .from(conflict)
        .where(
          and(
            inArray(conflict.registerId, [...registerIds]),
            eq(conflict.field, "catalogueStatus"),
            eq(conflict.status, "open"),
          ),
        ),
    ]);
    const withConflict = new Set(open.map((row) => row.registerId));
    for (const row of rows) {
      ledgers.set(row.id, { written: row.written, conflictOpen: withConflict.has(row.id) });
    }
    return ledgers;
  }

  async recordCatalogueStatusConflict(
    input: RecordCatalogueStatusConflictInput,
  ): Promise<RecordCatalogueStatusConflictResult> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: register.id })
        .from(register)
        .where(eq(register.id, input.registerId))
        .for("update");
      if (!locked) return { status: "not_found" };
      const [open] = await tx
        .select()
        .from(conflict)
        .where(
          and(
            eq(conflict.registerId, locked.id),
            eq(conflict.field, "catalogueStatus"),
            eq(conflict.status, "open"),
          ),
        )
        .limit(1);
      if (open && open.zohoValue === input.zohoStatus && open.laxValue === input.laxStatus) {
        return { status: "unchanged" };
      }
      await this.recordConflict(
        tx,
        locked.id,
        { field: "catalogueStatus", zohoValue: input.zohoStatus, laxValue: input.laxStatus },
        input.zohoModifiedAt,
        input.now,
      );
      return { status: "recorded" };
    });
  }

  /** LAX and Zoho agree again, so an open Status conflict has nothing left to decide. */
  private async closeStatusConflict(tx: Tx, registerId: string, now: Date): Promise<void> {
    const [closed] = await tx
      .update(conflict)
      .set({ status: "resolved", resolution: "kept_lax", resolvedBy: "system", resolvedAt: now })
      .where(
        and(
          eq(conflict.registerId, registerId),
          eq(conflict.field, "catalogueStatus"),
          eq(conflict.status, "open"),
        ),
      )
      .returning();
    if (!closed) return;
    await this.record(tx, registerId, "conflict_resolved", "system", now, {
      conflictId: closed.id,
      field: closed.field,
      resolution: "kept_lax",
    });
  }

  /** Puts Zoho's stock code on the artwork, if it is valid for it and free. */
  private async applyZohoStockCode(
    tx: Tx,
    open: typeof conflict.$inferSelect,
    now: Date,
  ): Promise<
    | { ok: true; applied: { field: string; from: string; to: string } }
    | { ok: false; reason: "invalid_stock_code" | "stock_code_taken" }
  > {
    const code = typeof open.zohoValue === "string" ? open.zohoValue : null;
    const parts = code ? parseStockCode(code) : null;
    const [entry] = await tx
      .select()
      .from(register)
      .where(eq(register.id, open.registerId))
      .for("update");
    if (!code || !parts || !entry || parts.kind !== entry.kind) {
      return { ok: false, reason: "invalid_stock_code" };
    }
    if (code === entry.stockCode)
      return { ok: true, applied: { field: "stockCode", from: code, to: code } };
    const [holder] = await tx
      .select({ id: register.id })
      .from(register)
      .where(eq(register.stockCode, code))
      .limit(1);
    if (holder) return { ok: false, reason: "stock_code_taken" };
    await tx
      .update(register)
      .set({ stockCode: code, updatedAt: now, version: sql`${register.version} + 1` })
      .where(eq(register.id, entry.id));
    return { ok: true, applied: { field: "stockCode", from: entry.stockCode, to: code } };
  }

  async recordMoveConfirmed(
    input: RecordMoveConfirmedInput,
  ): Promise<{ status: "not_found" | "recorded" | "already_recorded" }> {
    return this.db.transaction(async (tx) => {
      // The register row is locked, so two requests for the same lot cannot both record it.
      const [found] = await tx
        .select({ id: register.id })
        .from(register)
        .where(eq(register.id, input.registerId))
        .limit(1)
        .for("update");
      if (!found) return { status: "not_found" };
      const { lotId, direction } = input.record;
      if (lotId && (await this.moveAlreadyRecorded(tx, found.id, direction, lotId))) {
        return { status: "already_recorded" };
      }
      await this.record(tx, found.id, "move_confirmed", input.actor, input.now, {
        ...input.record,
      });
      return { status: "recorded" };
    });
  }

  private async moveAlreadyRecorded(
    tx: Tx,
    registerId: string,
    direction: string,
    lotId: string,
  ): Promise<boolean> {
    const [existing] = await tx
      .select({ id: event.id })
      .from(event)
      .where(
        and(
          eq(event.registerId, registerId),
          eq(event.type, "move_confirmed"),
          sql`${event.payload}->>'direction' = ${direction}`,
          sql`${event.payload}->>'lotId' = ${lotId}`,
        ),
      )
      .limit(1);
    return existing !== undefined;
  }

  async recordLaxArtDraftCreated(input: RecordLaxArtDraftCreatedInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.record(tx, input.registerId, "lax_art_draft_created", input.actor, input.now, {
        artworkId: input.artworkId,
      });
    });
  }

  async recordZohoLinked(input: RecordZohoLinkInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.record(tx, input.registerId, "zoho_link_linked", input.actor, input.now, {
        artworkId: input.artworkId,
        ...input.detail,
      });
    });
  }

  async recordZohoUnlinked(input: RecordZohoLinkInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.record(tx, input.registerId, "zoho_link_unlinked", input.actor, input.now, {
        artworkId: input.artworkId,
        ...input.detail,
      });
    });
  }

  async findImageSources(zohoProductId: string): Promise<ZohoImageSource[] | null> {
    const [row] = await this.db
      .select({ sources: register.imageSources })
      .from(register)
      .where(eq(register.zohoProductId, zohoProductId))
      .limit(1);
    return row ? row.sources : null;
  }

  async replaceZohoImages(input: ReplaceZohoImagesInput): Promise<ReplaceZohoImagesResult> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(register)
        .where(eq(register.zohoProductId, input.zohoProductId))
        .for("update");
      if (!locked) return { status: "not_found" };

      const sources = [...input.sources];
      const refs = imageKeysOf(sources);
      if (sameImageSources(locked.imageSources, sources) && sameKeys(locked.imageRefs, refs)) {
        await tx
          .update(register)
          .set({ imagesCheckedAt: input.now })
          .where(eq(register.id, locked.id));
        return { status: "unchanged" };
      }

      const [row] = await tx
        .update(register)
        .set({
          imageSources: sources,
          imageRefs: refs,
          imagesCheckedAt: input.now,
          updatedAt: input.now,
          version: sql`${register.version} + 1`,
        })
        .where(eq(register.id, locked.id))
        .returning();
      if (!row) return { status: "not_found" };
      await this.record(tx, row.id, "zoho_change_applied", "zoho", input.now, {
        fields: { imageRefs: { from: locked.imageRefs, to: refs } },
      });
      return { status: "replaced", entry: toEntry(row) };
    });
  }

  async listImageCheckCandidates(before: Date, limit: number): Promise<ImageCheckCandidate[]> {
    const rows = await this.db
      .select({ zohoProductId: register.zohoProductId, sources: register.imageSources })
      .from(register)
      .where(
        and(
          eq(register.kind, "original"),
          or(isNull(register.imagesCheckedAt), lt(register.imagesCheckedAt, before)),
        ),
      )
      .orderBy(sql`${register.imagesCheckedAt} NULLS FIRST`, asc(register.id))
      .limit(limit);
    return rows.map((row) => ({ zohoProductId: row.zohoProductId, sources: row.sources }));
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
    found: Omit<FieldConflict, "field"> & { field: RegisterConflictField },
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

  /** Appends a domain event in the caller's transaction, so it exists exactly when the change does. */
  private async publish(
    tx: Tx,
    registerId: string,
    eventType: "artwork_register.offer_changed" | "artwork_register.stock_code_assigned",
    payload: Record<string, unknown>,
  ): Promise<void> {
    await tx.insert(domainEvent).values({
      aggregateType: "artwork_register",
      aggregateId: registerId,
      eventType,
      producer: "packages/db",
      payload,
      schemaVersion: 1,
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
    // History is read in time order, so each entry is stamped strictly after the one before it,
    // even when the caller's clock repeats or steps back.
    const [latest] = await tx
      .select({ createdAt: event.createdAt })
      .from(event)
      .where(eq(event.registerId, registerId))
      .orderBy(desc(event.createdAt))
      .limit(1);
    const createdAt =
      latest && latest.createdAt.getTime() >= now.getTime()
        ? new Date(latest.createdAt.getTime() + 1)
        : now;
    await tx.insert(event).values({ registerId, type, actor, payload, createdAt });
  }
}

/** The two-digit registration year, in London time. */
function registrationYear(now: Date): number {
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
  }).format(now);
  return Number(year) % 100;
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}
