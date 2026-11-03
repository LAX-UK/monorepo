import type {
  ArtworkRegisterEntry,
  FieldConflict,
  NewArtworkRegisterEntry,
  OfferRef,
  OfferState,
  OfferTransitionRefusal,
  RegisterField,
  ZohoChange,
} from "@auction/artwork-register-contracts";

/** `zoho`, `system`, or `staff:<user id>`. */
export type RegisterActor = string;

export type RegisterEventType =
  | "created"
  | "offer_moved"
  | "zoho_change_applied"
  | "conflict_recorded"
  | "conflict_resolved"
  | "zoho_writeback_recorded";

export type RegisterEvent = {
  id: string;
  registerId: string;
  type: RegisterEventType;
  actor: RegisterActor;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type RegisterConflict = {
  id: string;
  registerId: string;
  field: FieldConflict["field"];
  zohoValue: unknown;
  laxValue: unknown;
  status: "open" | "resolved";
  resolution: "kept_lax" | "accepted_zoho" | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  zohoModifiedAt: Date;
  detectedAt: Date;
};

export type ConflictCursor = { detectedAt: Date; id: string };

/** Reads that Bid, Shop and staff screens share. */
export interface IArtworkRegisterReader {
  findById(id: string): Promise<ArtworkRegisterEntry | null>;
  findByZohoProductId(zohoProductId: string): Promise<ArtworkRegisterEntry | null>;
  findByStockCode(stockCode: string): Promise<ArtworkRegisterEntry | null>;
  /** The highest number issued under a stock code prefix such as `LAX-ORI-PH-GAC-26`, or null. */
  highestStockNumber(prefix: string): Promise<number | null>;
  listEvents(registerId: string, limit: number): Promise<RegisterEvent[]>;
  /** Open conflicts, oldest first. */
  listOpenConflicts(limit: number, after?: ConflictCursor): Promise<RegisterConflict[]>;
}

export type CreateRegisterEntryResult =
  | { ok: true; entry: ArtworkRegisterEntry }
  | {
      ok: false;
      reason: "duplicate_zoho_product" | "duplicate_stock_code" | "source_original_invalid";
    };

export type ApplyZohoChangeResult =
  | { status: "not_found" }
  /** The entry already holds this change or a newer one. */
  | { status: "stale"; entry: ArtworkRegisterEntry }
  | {
      status: "applied";
      entry: ArtworkRegisterEntry;
      applied: RegisterField[];
      conflicts: FieldConflict[];
    };

export type MoveOfferInput = {
  registerId: string;
  /** The version the caller read; the move is refused if the record has changed since. */
  expectedVersion: number;
  to: OfferState;
  ref: OfferRef | null;
  actor: RegisterActor;
  now: Date;
};

export type MoveOfferResult =
  | { ok: true; entry: ArtworkRegisterEntry }
  | { ok: false; reason: "not_found" | "version_conflict" | OfferTransitionRefusal };

export type ResolveConflictInput = {
  conflictId: string;
  resolution: "kept_lax" | "accepted_zoho";
  resolvedBy: RegisterActor;
  now: Date;
};

export type ResolveConflictResult =
  | { ok: true; conflict: RegisterConflict }
  | {
      ok: false;
      reason:
        | "not_found"
        | "already_resolved"
        /** Accepting Zoho's value is not offered for this field. */
        | "cannot_accept_field"
        /** Zoho's stock code is not a LAX stock code, or would turn an original into a print. */
        | "invalid_stock_code"
        /** Another artwork already holds Zoho's stock code. */
        | "stock_code_taken";
    };

export type RecordCatalogueStatusWrittenInput = {
  registerId: string;
  /** The Status LAX wrote to the Zoho Product. */
  status: string;
  now: Date;
};

export type RecordCatalogueStatusWrittenResult = {
  status: "not_found" | "unchanged" | "recorded";
};

/**
 * Writes to the register. Every write that changes a record is optimistic (the version moves
 * on) and leaves an event. Bid and Shop reach the register only through this port.
 */
export interface IArtworkRegisterRepository extends IArtworkRegisterReader {
  /** Adds a record, held and unlisted, and records that it was created. */
  create(
    entry: NewArtworkRegisterEntry,
    actor: RegisterActor,
    now: Date,
  ): Promise<CreateRegisterEntryResult>;
  /**
   * Applies a change reported by Zoho: Zoho-owned fields are updated, LAX-owned fields that
   * differ become open conflicts and are never applied. Safe to call twice with the same change.
   */
  applyZohoChange(change: ZohoChange, now: Date): Promise<ApplyZohoChangeResult>;
  /** Moves the artwork to a new place under the one-place-at-a-time rules. */
  moveOffer(input: MoveOfferInput): Promise<MoveOfferResult>;
  /**
   * Notes that LAX wrote this Status to the Zoho Product, so the register's copy of Zoho's value
   * matches and the change coming back through the inbound sync is seen as no change.
   */
  recordCatalogueStatusWritten(
    input: RecordCatalogueStatusWrittenInput,
  ): Promise<RecordCatalogueStatusWrittenResult>;
  /**
   * Decides a conflict. Keeping LAX's value changes nothing in the register. Accepting Zoho's value
   * for a stock code applies it in the same transaction, after checking it is a valid code for
   * this artwork and that no other artwork holds it; otherwise the conflict stays open.
   */
  resolveConflict(input: ResolveConflictInput): Promise<ResolveConflictResult>;
}
