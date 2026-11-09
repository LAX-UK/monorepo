import type {
  EditionFacts,
  EditionListingStatus,
  PlannedEdition,
  PrintException,
  ProofType,
  RunUsage,
} from "@auction/shop-domain";
import type { EditionRunRepository } from "../ports/edition-run.repository.js";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "../ports/shop-admin-command.writer.js";
import type { ShopDomainEventWriter } from "../ports/shop-domain-event.writer.js";
import type { ShopTransactionEffects } from "../ports/shop-unit-of-work.js";

/** The artwork a run belongs to, locked for the length of the transaction. */
export type RunArtwork = {
  artworkId: string;
  artistId: string;
  slug: string;
  title: string;
  /** The lax.art original it was made from; buyer prints depend on it. */
  sourceOriginalArtworkId: string | null;
  /** Whether the artwork sells prints (it has a run) or is an original. */
  sellsPrints: boolean;
  /** Archived artworks are out of the catalogue until restored. */
  archived: boolean;
  /** The artwork's version, as the editor holds it. */
  updatedAt: Date;
};

/** One print of a run, locked for the length of the transaction, with what decides whether it can be set apart. */
export type StoredPrint = {
  editionId: string;
  /** The artwork whose run the print belongs to. */
  artworkId: string;
  editionNumber: number | null;
  proofNumber: number | null;
  stockRef: number;
  /** Who holds the print: the artist, LAX, or a buyer who is entitled to one. */
  owner: "artist" | "lax" | "buyer";
  listingStatus: EditionListingStatus;
  reservedUntil: Date | null;
  /** An unpaid order still holds the print, whatever the reservation says. */
  reservedByPendingOrder: boolean;
  /** Owned by the artist or LAX and in a place it can be sold from. */
  forSale: boolean;
};

/**
 * The prints of a run inside one transaction. `lockArtwork` takes a row lock on the artwork, so
 * two changes to one run queue behind each other and the checks below see the winner's change.
 */
export interface EditionPrintStore {
  lockArtwork(artworkId: string): Promise<RunArtwork | null>;
  /** How far selling has gone: prints offered for sale and orders paid (rule 13). */
  usage(artworkId: string): Promise<RunUsage>;
  /** Creates the planned prints: unprinted, not on sale, owned per their allocation. */
  createPrints(input: {
    artworkId: string;
    artistId: string;
    plan: PlannedEdition[];
  }): Promise<number>;
  /** Removes every print and stock batch of a run nothing has been offered from. */
  clearPrints(artworkId: string): Promise<void>;
  /** Puts LAX's prints in a new open edition batch on sale, with a sale authority record. */
  authoriseLaxPrints(input: {
    artworkId: string;
    stockRefs: readonly number[];
    actorSubjectId: string;
  }): Promise<number>;
  /** Proofs of this type already listed from a main run, across its proof listings. */
  listedProofCount(mainRunId: string, proofType: ProofType): Promise<number>;
  /** Marks the artwork changed and returns its new version. */
  touch(artworkId: string): Promise<string>;
  /** Records the shop admin's approval to sell a hors commerce proof listing. */
  recordHorsCommerceApproval(artworkId: string, actorSubjectId: string): Promise<void>;
  /** Locks one print and reads its state; null when there is no such print. */
  loadPrint(editionId: string): Promise<StoredPrint | null>;
  /**
   * Moves a print to another artwork's listing, keeping its number, owner and sale authority. A
   * print that is on sale arrives with a recorded authority, like every print on sale.
   */
  movePrint(input: {
    editionId: string;
    toArtworkId: string;
    actorSubjectId: string;
    authorityNote: string;
  }): Promise<void>;
  /** Takes a listing off the shop for good: archived and unpublished. */
  retireListing(artworkId: string): Promise<void>;
}

/** A print set apart from its run, with what differs about it. */
export type StoredPrintException = {
  id: string;
  editionId: string;
  runArtworkId: string;
  listingArtworkId: string;
  differences: PrintException;
  setApartBySubjectId: string;
  setApartAt: Date;
};

export interface PrintExceptionStore {
  insert(input: {
    editionId: string;
    runArtworkId: string;
    listingArtworkId: string;
    differences: PrintException;
    actorSubjectId: string;
  }): Promise<void>;
  /** The record of the print a listing sells, while it is set apart; null once returned. */
  openForListing(listingArtworkId: string): Promise<StoredPrintException | null>;
  markReturned(id: string, actorSubjectId: string): Promise<void>;
}

export type StoredFacts = {
  facts: EditionFacts;
  /** The facts row's `updatedAt`: what a save hands back as `expectedFactsVersion`. */
  version: string;
};

/** An order already paid for a print of the run. */
export type PaidOrderRef = { orderId: string; reference: string; paidAt: Date | null };

export interface EditionFactsStore {
  get(artworkId: string): Promise<StoredFacts | null>;
  /**
   * Replaces the facts and returns the new version. The database refuses forbidden combinations.
   * `recorded` is who saved them and when: given, it is kept with the certificate authority's
   * letter reference; left out, the stored record of that reference is not touched.
   */
  save(
    artworkId: string,
    facts: EditionFacts,
    recorded?: { by: string; at: Date },
  ): Promise<string>;
  paidOrders(artworkId: string): Promise<PaidOrderRef[]>;
  /**
   * Records `snapshot` on the run's paid order lines that do not have one yet, so a correction
   * never changes how an order already sold was described. Returns how many lines it wrote.
   */
  keepOrderSnapshots(artworkId: string, snapshot: Record<string, unknown>): Promise<number>;
}

/** Creates the artwork for a proof or companion listing from its main run. */
export interface LinkedListingWriter {
  copyFromMainRun(input: {
    mainArtworkId: string;
    slug: string;
    /** "next_free" moves a taken slug to "-2", "-3"…; "refuse" answers 409 on the slug. */
    onSlugTaken: "refuse" | "next_free";
    title: string;
    printPricePence: number | null;
  }): Promise<{ artworkId: string; slug: string; version: string }>;
}

/** Creates the draft listing of prints made from an original. */
export interface OriginalPrintsWriter {
  copyFromOriginal(input: {
    originalArtworkId: string;
    /** The first of "-2", "-3"… that is free when the slug is taken. */
    slug: string;
    title: string;
  }): Promise<{ artworkId: string; slug: string; importKey: string }>;
}

export type EditionRunTx = {
  runs: EditionRunRepository;
  prints: EditionPrintStore;
  facts: EditionFactsStore;
  exceptions: PrintExceptionStore;
  listings: LinkedListingWriter;
  originalPrints: OriginalPrintsWriter;
  events: ShopDomainEventWriter;
  audit: ShopAdminAuditWriter;
  commands: ShopAdminCommandWriter;
};

export interface EditionRunUnitOfWork {
  run<T>(fn: (tx: EditionRunTx) => Promise<T>): Promise<T>;
  /** The same ports on a transaction another writer already opened (artwork create). */
  bind(effects: ShopTransactionEffects): EditionRunTx;
}

export type Clock = { now(): Date };

/** Who is acting, under which idempotency key. */
export type StaffCommand = { actorSubjectId: string; idempotencyKey: string };
