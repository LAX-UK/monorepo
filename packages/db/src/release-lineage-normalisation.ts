import {
  APPROVED_RELEASE_ROWS,
  type ApprovedReleaseRow,
  RELEASE_LINEAGE_BASELINE,
} from "./release-lineage-mapping.js";

/**
 * Pure verification for release lineage normalisation: given what the ledger and the archive
 * hold, decide whether to archive the release rows, report that it is already done, or refuse.
 * No I/O; the writer adapter (`release-lineage-archive.ts`) carries out an `archive` plan.
 */

export type LedgerRow = { id: number; hash: string; createdAt: number };

export type ArchivedReleaseRow = { hash: string; createdAt: number; releaseTag: string };

/** A main journal migration as the runner sees it: stamp and SQL hash. */
export type JournalMigration = { folderMillis: number; hash: string };

export type ReleaseRowToArchive = { ledgerId: number; row: ApprovedReleaseRow };

export type NormalisationPlan =
  | { status: "archive"; rows: readonly ReleaseRowToArchive[] }
  | { status: "already-normalised"; mainRowsAboveBaseline: number };

export type NormalisationInput = {
  ledger: readonly LedgerRow[];
  archive: readonly ArchivedReleaseRow[];
  journal: readonly JournalMigration[];
  approvedRows?: readonly ApprovedReleaseRow[];
  baselineWhen?: number;
};

export class ReleaseLineageRefusal extends Error {
  override readonly name = "ReleaseLineageRefusal";
}

function refuse(message: string): never {
  throw new ReleaseLineageRefusal(`${message}. Nothing was changed.`);
}

function indexByStamp<T extends { createdAt: number }>(rows: readonly T[], what: string) {
  const byStamp = new Map<number, T>();
  for (const row of rows) {
    if (byStamp.has(row.createdAt)) refuse(`The ${what} holds two rows at ${row.createdAt}`);
    byStamp.set(row.createdAt, row);
  }
  return byStamp;
}

/** Every row up to the baseline must be main's (and release's) shared migration at that stamp. */
function verifySharedPrefix(
  ledger: readonly LedgerRow[],
  journalByStamp: ReadonlyMap<number, string>,
  baselineWhen: number,
): void {
  const shared = ledger.filter((row) => row.createdAt <= baselineWhen);
  for (const row of shared) {
    const expected = journalByStamp.get(row.createdAt);
    if (expected === undefined) refuse(`Unknown ledger row at ${row.createdAt}`);
    if (expected !== row.hash) refuse(`Ledger row ${row.createdAt} does not hold main's hash`);
  }
  if (!shared.some((row) => row.createdAt === baselineWhen)) {
    refuse(`The ledger does not reach the shared baseline ${baselineWhen}`);
  }
}

/** Fresh production ledger: the rows above the baseline must be exactly the approved head's. */
function planArchive(
  above: readonly LedgerRow[],
  approvedRows: readonly ApprovedReleaseRow[],
): NormalisationPlan {
  const approvedByStamp = new Map(approvedRows.map((row) => [row.releaseWhen, row]));
  const rows = above.map((ledgerRow) => {
    const approved = approvedByStamp.get(ledgerRow.createdAt);
    if (!approved) {
      refuse(`Unknown ledger row at ${ledgerRow.createdAt} (hash ${ledgerRow.hash})`);
    }
    if (approved.sha256 !== ledgerRow.hash) {
      refuse(
        `Ledger row ${ledgerRow.createdAt} holds ${ledgerRow.hash}, not the approved ${approved.releaseTag} hash ${approved.sha256}`,
      );
    }
    return { ledgerId: ledgerRow.id, row: approved };
  });
  const present = new Set(above.map((row) => row.createdAt));
  for (const approved of approvedRows) {
    if (!present.has(approved.releaseWhen)) {
      refuse(
        `The ledger has no ${approved.releaseTag} row at ${approved.releaseWhen}; it is not at the approved release head`,
      );
    }
  }
  return { status: "archive", rows };
}

/**
 * Already archived: the archive must hold exactly the approved rows, and anything above the
 * baseline must be main's own migrations recorded by the runner since.
 */
function planAlreadyNormalised(
  above: readonly LedgerRow[],
  archive: readonly ArchivedReleaseRow[],
  approvedRows: readonly ApprovedReleaseRow[],
  journalByStamp: ReadonlyMap<number, string>,
): NormalisationPlan {
  const archiveByStamp = indexByStamp(archive, "release lineage archive");
  for (const approved of approvedRows) {
    const archived = archiveByStamp.get(approved.releaseWhen);
    if (!archived || archived.hash !== approved.sha256) {
      refuse(
        `The release lineage archive does not hold the approved ${approved.releaseTag} row; review it by hand`,
      );
    }
  }
  if (archive.length !== approvedRows.length) {
    refuse("The release lineage archive holds rows the approved head does not; review it by hand");
  }
  for (const row of above) {
    if (journalByStamp.get(row.createdAt) !== row.hash) {
      refuse(
        `Ledger row ${row.createdAt} is neither a main migration nor in the archive; review it by hand`,
      );
    }
  }
  return { status: "already-normalised", mainRowsAboveBaseline: above.length };
}

export function planReleaseLineageNormalisation(input: NormalisationInput): NormalisationPlan {
  const approvedRows = input.approvedRows ?? APPROVED_RELEASE_ROWS;
  const baselineWhen = input.baselineWhen ?? RELEASE_LINEAGE_BASELINE.when;
  indexByStamp(input.ledger, "ledger");
  const journalByStamp = new Map(input.journal.map((m) => [m.folderMillis, m.hash]));

  verifySharedPrefix(input.ledger, journalByStamp, baselineWhen);
  const above = input.ledger
    .filter((row) => row.createdAt > baselineWhen)
    .sort((a, b) => a.createdAt - b.createdAt);

  return input.archive.length === 0
    ? planArchive(above, approvedRows)
    : planAlreadyNormalised(above, input.archive, approvedRows, journalByStamp);
}
