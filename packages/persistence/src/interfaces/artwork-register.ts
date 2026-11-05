import type {
  ArtworkRegisterEntry,
  FieldConflict,
  MoveRecord,
  NewArtworkRegisterEntry,
  OfferRef,
  OfferState,
  OfferTransitionRefusal,
  RegisterField,
  StockCodeKind,
  StockCodeSeries,
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
  | "zoho_writeback_recorded"
  | "move_confirmed"
  | "lax_art_draft_created";

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
  /**
   * The highest number issued for a kind, artist and collection in any year, or null. Prints
   * count both `LAX-PRT-` and the older `LAX-PRI-` codes.
   */
  highestStockNumber(series: StockCodeSeries): Promise<number | null>;
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

/** A new artwork whose stock code LAX chooses. */
export type IssueRegisterEntry = Omit<
  NewArtworkRegisterEntry,
  "stockCode" | "kind" | "sourceOriginalId"
> & {
  /** The collection code, 2 to 4 capital letters or digits. */
  collectionCode: string;
};

export type IssueRegisterEntryResult =
  | { ok: true; entry: ArtworkRegisterEntry }
  | {
      ok: false;
      reason:
        | "duplicate_zoho_product"
        | "invalid_code"
        | "original_not_found"
        | "numbers_exhausted"
        /** The mirrored print code already belongs to a print of a different original. */
        | "print_code_taken_by_other_original"
        /** This original already has its print group. */
        | "print_group_exists";
      message: string;
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
   * Adds a record under the next free stock code for its kind, artist and collection. The number
   * runs across years, so the registration year is only written into the code. Issuing is
   * serialised per kind, artist and collection, so concurrent calls never share a number.
   */
  issue(
    kind: StockCodeKind,
    entry: IssueRegisterEntry,
    actor: RegisterActor,
    now: Date,
  ): Promise<IssueRegisterEntryResult>;
  /**
   * Adds the print group of an original, with the original's artist, collection, year and number
   * (`LAX-ORI-MP-GAC-26-0037` becomes `LAX-PRT-MP-GAC-26-0037`). Never renumbers: a code already
   * held by a print of another original is refused.
   */
  issuePrintGroup(
    originalId: string,
    entry: Omit<IssueRegisterEntry, "collectionCode" | "artist">,
    actor: RegisterActor,
    now: Date,
  ): Promise<IssueRegisterEntryResult>;
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

export type RecordMoveConfirmedInput = {
  registerId: string;
  /** `staff:<user id>` of the person who confirmed the move. */
  actor: RegisterActor;
  /** What was confirmed: the direction, the sale or lot, and the consignor's agreement. */
  record: MoveRecord;
  now: Date;
};

/**
 * Keeps the reason behind a move in the register's history, next to the offer moves themselves:
 * who confirmed it, where it went, and whether the consignor's agreement was confirmed.
 */
export interface IArtworkMoveHistory {
  recordMoveConfirmed(
    input: RecordMoveConfirmedInput,
  ): Promise<{ status: "not_found" | "recorded" }>;
}

export type RecordLaxArtDraftCreatedInput = {
  registerId: string;
  /** `staff:<user id>` of the person who made the draft. */
  actor: RegisterActor;
  artworkId: string;
  now: Date;
};

/** Keeps "a lax.art draft was made from this record" in the register's history. */
export interface IArtworkDraftHistory {
  recordLaxArtDraftCreated(input: RecordLaxArtDraftCreatedInput): Promise<void>;
}

export type AuctionOfferSale = { id: string; title: string; startsAt: Date; endsAt: Date };

export type AuctionOfferDraftLot = {
  lotId: string;
  saleId: string | null;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
};

/** What LAX Bid shows another product that wants to offer an artwork at auction. */
export interface IAuctionOfferReader {
  /** Sales still being set up and not yet started, soonest first. */
  listSalesOpenForOffer(now: Date): Promise<AuctionOfferSale[]>;
  /** The lot that currently holds this artwork's place in Bid (draft, scheduled or live), if any. */
  findOpenLotForRegister(registerId: string): Promise<AuctionOfferDraftLot | null>;
}

export type LotRegisterLink = {
  registerId: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
  hasWinner: boolean;
};

/**
 * Which register record a Bid lot offers, and where the lot stands. The lot stores the link in its
 * own table; this reads it so the offer lock never needs the lot's other columns.
 */
export interface ILotRegisterLinkReader {
  /** The lot's link to the register, or null when the lot has none (or does not exist). */
  findLink(lotId: string): Promise<LotRegisterLink | null>;
}
