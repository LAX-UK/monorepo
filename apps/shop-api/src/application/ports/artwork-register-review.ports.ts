import type {
  ArtworkRegisterEntry,
  CatalogueGap,
  FieldConflict,
} from "@auction/artwork-register-contracts";

/**
 * What the From Zoho queue needs from the artwork register. The register belongs to neither Shop
 * nor Bid; the container connects these ports to its repositories.
 */

export type RegisterConflictRecord = {
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

export type RegisterEventRecord = {
  id: string;
  registerId: string;
  type: string;
  /** `zoho`, `system`, or `staff:<user id>`. */
  actor: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

/** Narrows a queue by the artist part of the stock code and by one missing part. */
export type RegisterQueueFilter = { artistCode?: string; missing?: CatalogueGap };
export type RegisterQueuePage = { limit: number; offset: number };
export type QueuedConflictRecord = {
  conflict: RegisterConflictRecord;
  entry: ArtworkRegisterEntry;
};

export interface ArtworkRegisterQueue {
  /** Held records, newest Zoho edit first; `total` counts every match. */
  listHeld(
    filter: RegisterQueueFilter,
    page: RegisterQueuePage,
  ): Promise<{ entries: ArtworkRegisterEntry[]; total: number }>;
  /** Open conflicts with their artwork, oldest first. */
  listOpenConflicts(
    filter: RegisterQueueFilter,
    page: RegisterQueuePage,
  ): Promise<{ items: QueuedConflictRecord[]; total: number }>;
  listConflictsFor(registerId: string): Promise<RegisterConflictRecord[]>;
  countHeld(): Promise<number>;
  countOpenConflicts(): Promise<number>;
  listHeldArtists(): Promise<{ code: string; name: string; count: number }[]>;
}

export interface ArtworkRegisterRecords {
  findById(id: string): Promise<ArtworkRegisterEntry | null>;
  listEvents(registerId: string, limit: number): Promise<RegisterEventRecord[]>;
}

export type ResolveConflictCommand = {
  conflictId: string;
  resolution: "kept_lax" | "accepted_zoho";
  /** `staff:<user id>`. */
  resolvedBy: string;
  now: Date;
};

export interface ConflictResolver {
  resolveConflict(
    input: ResolveConflictCommand,
  ): Promise<
    | { ok: true; conflict: RegisterConflictRecord }
    | { ok: false; reason: "not_found" | "already_resolved" }
  >;
}

export type SyncRunSummary = {
  mode: "dry_run" | "live";
  finishedAt: Date;
  total: number;
  byOutcome: {
    create: number;
    update: number;
    conflict: number;
    unchanged: number;
    stale: number;
    skipped: number;
  };
  skippedReasons: { reason: string; count: number }[];
  gaps: { gap: string; count: number }[];
};

export interface SyncRunReader {
  /** The newest nightly pass, or null before the first one. */
  latestNightlyRun(): Promise<SyncRunSummary | null>;
}
