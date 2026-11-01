import { assertApprovedReleaseHead } from "./release-lineage-mapping.js";
import {
  type ArchivedReleaseRow,
  type JournalMigration,
  type LedgerRow,
  type NormalisationPlan,
  type ReleaseRowToArchive,
  planReleaseLineageNormalisation,
} from "./release-lineage-normalisation.js";

/** What normalisation reads and writes, inside one transaction. */
export interface ReleaseLineageLedger {
  readLedger(): Promise<LedgerRow[]>;
  readArchive(): Promise<ArchivedReleaseRow[]>;
  /** Copy the rows into the archive and remove them from the ledger. */
  archive(rows: readonly ReleaseRowToArchive[], releaseHead: string): Promise<void>;
}

export type NormalisationMode = "dry-run" | "apply";

/**
 * Runs `work` in one transaction. A dry run must not write: the adapter opens it read-only and
 * always rolls back. An apply locks the ledger first and commits only if `work` succeeds.
 */
export interface ReleaseLineageUnitOfWork {
  run<T>(mode: NormalisationMode, work: (ledger: ReleaseLineageLedger) => Promise<T>): Promise<T>;
}

export type NormalisationReport = {
  mode: NormalisationMode;
  releaseHead: string;
  plan: NormalisationPlan;
  /** True only when this run moved rows into the archive. */
  wrote: boolean;
};

export async function normaliseReleaseLineage(options: {
  unitOfWork: ReleaseLineageUnitOfWork;
  journal: readonly JournalMigration[];
  releaseHead: string;
  mode: NormalisationMode;
}): Promise<NormalisationReport> {
  assertApprovedReleaseHead(options.releaseHead);
  return options.unitOfWork.run(options.mode, async (ledger) => {
    const plan = planReleaseLineageNormalisation({
      ledger: await ledger.readLedger(),
      archive: await ledger.readArchive(),
      journal: options.journal,
    });
    const report = { mode: options.mode, releaseHead: options.releaseHead, plan };
    if (options.mode === "apply" && plan.status === "archive") {
      await ledger.archive(plan.rows, options.releaseHead);
      return { ...report, wrote: true };
    }
    return { ...report, wrote: false };
  });
}
