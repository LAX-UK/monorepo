/** Which kind of pass wrote a result, and whose watermark it moves. */
export type ZohoArtworkSyncMode = "dry_run" | "live";

export type ZohoArtworkSyncOutcomeKind =
  | "create"
  | "update"
  | "conflict"
  | "unchanged"
  | "stale"
  | "skipped";

/** The result for one Zoho Product in one pass. */
export type ZohoArtworkSyncOutcomeInput = {
  zohoProductId: string;
  stockCode: string | null;
  title: string | null;
  outcome: ZohoArtworkSyncOutcomeKind;
  /** Why a Product was skipped, or what is missing on one that would be created. */
  reason: string | null;
  /** The fields that change, the conflicts and any gaps, as plain data for the report. */
  detail: Record<string, unknown>;
  zohoModifiedAt: Date | null;
};

export type ZohoArtworkSyncOutcome = ZohoArtworkSyncOutcomeInput & {
  id: string;
  runId: string;
  mode: ZohoArtworkSyncMode;
  recordedAt: Date;
};

/** Counts of each outcome in a pass. */
export type ZohoArtworkSyncSummary = Record<ZohoArtworkSyncOutcomeKind, number>;

/** How far the nightly check has read, kept per mode. */
export interface IZohoArtworkSyncWatermark {
  /** The newest Zoho modified time read in this mode, or null before the first pass finishes. */
  get(mode: ZohoArtworkSyncMode): Promise<Date | null>;
  /** Moves the watermark forward; an earlier time never moves it back. */
  advance(mode: ZohoArtworkSyncMode, to: Date, now: Date): Promise<void>;
}

/** The report of what a pass created, changed or left alone. */
export interface IZohoArtworkSyncReport {
  /** Records results for a pass; recording the same Product in the same pass again replaces it. */
  record(
    runId: string,
    mode: ZohoArtworkSyncMode,
    outcomes: readonly ZohoArtworkSyncOutcomeInput[],
    now: Date,
  ): Promise<void>;
  listForRun(runId: string, limit: number): Promise<ZohoArtworkSyncOutcome[]>;
  summarise(runId: string): Promise<ZohoArtworkSyncSummary>;
}
