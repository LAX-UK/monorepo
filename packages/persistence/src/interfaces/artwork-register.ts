import type {
  ArtworkRegisterEntry,
  FieldConflict,
  MoveRecord,
  NewArtworkRegisterEntry,
  OfferRef,
  OfferState,
  OfferTransitionRefusal,
  RegisterConflictField,
  RegisterField,
  StockCodeKind,
  StockCodeSeries,
  ZohoChange,
  ZohoImageSource,
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
  | "lax_art_draft_created"
  | "zoho_link_linked"
  | "zoho_link_unlinked";

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
  field: RegisterConflictField;
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

export type CatalogueStatusLedger = {
  written: string | null;
  conflictOpen: boolean;
};

export type RecordCatalogueStatusConflictInput = {
  registerId: string;
  /** The Status the Zoho Product shows now. */
  zohoStatus: string;
  /** The Status LAX would have written. */
  laxStatus: string;
  /** When the Zoho Product was last modified, as read with the Status. */
  zohoModifiedAt: Date;
  now: Date;
};

export type RecordCatalogueStatusConflictResult = {
  /** `unchanged` when an open conflict already holds both values. */
  status: "not_found" | "unchanged" | "recorded";
};

/**
 * Writes to the register. Every write that changes a record is optimistic (the version moves
 * on) and leaves an event. Bid and Shop reach the register only through this port.
 */
export interface IArtworkRegisterRepository
  extends IArtworkRegisterReader,
    IRegisterOfferConflicts {
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
   * matches and the change coming back through the inbound sync is seen as no change. The value is
   * also kept apart as the Status LAX last wrote, and an open Status conflict for the record is
   * closed: LAX and Zoho agree again.
   */
  recordCatalogueStatusWritten(
    input: RecordCatalogueStatusWrittenInput,
  ): Promise<RecordCatalogueStatusWrittenResult>;
  /**
   * Closes an open Status conflict because Zoho now shows the Status LAX wants. Records nothing as
   * "written": LAX sent nothing, so `catalogue_status_written` is left as it is. The event says the
   * conflict closed because Zoho matched LAX, not because LAX wrote.
   */
  closeCatalogueStatusConflict(input: { registerId: string; now: Date }): Promise<{
    closed: boolean;
  }>;
  /**
   * For each record found: the Status LAX last wrote to the Zoho Product (null when it has not
   * written one) and whether a Status conflict is open. Records not found are absent.
   */
  findCatalogueStatusLedgers(
    registerIds: readonly string[],
  ): Promise<Map<string, CatalogueStatusLedger>>;
  /**
   * Raises a Status conflict: Zoho shows a value LAX did not write, so LAX left it alone. Raising
   * it again with the same values changes nothing; with other values it updates the open one.
   */
  recordCatalogueStatusConflict(
    input: RecordCatalogueStatusConflictInput,
  ): Promise<RecordCatalogueStatusConflictResult>;
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
 * who confirmed it, where it went, and whether the consignor's agreement was confirmed. A move
 * that names a lot is recorded once per lot and direction, so a retry or a second click does not
 * add a second entry.
 */
export interface IArtworkMoveHistory {
  recordMoveConfirmed(
    input: RecordMoveConfirmedInput,
  ): Promise<{ status: "not_found" | "recorded" | "already_recorded" }>;
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

export type ReplaceZohoImagesInput = {
  zohoProductId: string;
  /** Zoho's pictures in Zoho's order; the first is the cover. May be empty. */
  sources: readonly ZohoImageSource[];
  now: Date;
};

export type ReplaceZohoImagesResult =
  | { status: "not_found" }
  /** The pictures already matched; only the time they were checked moved. */
  | { status: "unchanged" }
  | { status: "replaced"; entry: ArtworkRegisterEntry };

export type ImageCheckCandidate = {
  zohoProductId: string;
  sources: ZohoImageSource[];
};

/**
 * The record of which Zoho picture each stored copy came from. Separate from the register's other
 * Zoho-owned fields because pictures change without Zoho changing the Product's modified time.
 */
export interface IArtworkImageStore {
  /** The pictures the register holds for a Product, or null when it has no record. */
  findImageSources(zohoProductId: string): Promise<ZohoImageSource[] | null>;
  /**
   * Replaces the pictures with Zoho's current ones and notes the check. A change bumps the record's
   * version and leaves a history entry; an unchanged list leaves both alone.
   */
  replaceZohoImages(input: ReplaceZohoImagesInput): Promise<ReplaceZohoImagesResult>;
  /** Records never checked, then those checked longest ago before `before`. */
  listImageCheckCandidates(before: Date, limit: number): Promise<ImageCheckCandidate[]>;
}

export type AuctionOfferSale = { id: string; title: string; startsAt: Date; endsAt: Date };

export type AuctionOfferDraftLotSummary = {
  lotId: string;
  saleId: string | null;
  saleTitle: string | null;
};

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
  /** The artwork's draft lot, with its sale's title; null once the lot is scheduled or gone. */
  findDraftLotForRegister(registerId: string): Promise<AuctionOfferDraftLotSummary | null>;
}

export type LotRegisterLink = {
  registerId: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
  hasWinner: boolean;
  /** ATG reports the lot sold. A lot sold there has no LAX winner, so this is its only sold fact. */
  soldOnAtg: boolean;
};

/**
 * Which register record a Bid lot offers, and where the lot stands. The lot stores the link in its
 * own table; this reads it so the offer lock never needs the lot's other columns.
 */
export interface ILotRegisterLinkReader {
  /** The lot's link to the register, or null when the lot has none (or does not exist). */
  findLink(lotId: string): Promise<LotRegisterLink | null>;
}

/** Whether a lot was sold on ATG (The Saleroom). */
export interface IAtgLotSoldReader {
  /** True when ATG's result for the lot says it sold. False for a lot with no ATG link. */
  soldOnAtg(lotId: string): Promise<boolean>;
}

export type RecordOfferConflictInput = {
  registerId: string;
  /** Why staff need to look, in words they can act on. */
  message: string;
  /** Where the register shows the artwork now. */
  state: OfferState;
  /** The lot the change was for. */
  lotId: string;
  now: Date;
};

/** Raises a staff item for an offer change the register could not make. */
export interface IRegisterOfferConflicts {
  /** Opens (or refreshes) the open offer-state conflict. True when a new one was opened. */
  recordOfferConflict(input: RecordOfferConflictInput): Promise<boolean>;
}

export type RecordZohoLinkInput = {
  registerId: string;
  /** `staff:<user id>` of the person who linked or unlinked. */
  actor: RegisterActor;
  artworkId: string;
  now: Date;
  /** What lax.art held before Zoho's values replaced it (linking), or why it was undone (unlinking). */
  detail: Record<string, unknown>;
};

/**
 * Keeps every link between a lax.art original and its register record in the record's history:
 * who linked or unlinked it, when, and why.
 */
export interface IArtworkLinkHistory {
  recordZohoLinked(input: RecordZohoLinkInput): Promise<void>;
  recordZohoUnlinked(input: RecordZohoLinkInput): Promise<void>;
}
