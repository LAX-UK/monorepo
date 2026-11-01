import { describe, expect, it } from "vitest";
import {
  APPROVED_RELEASE_HEAD,
  APPROVED_RELEASE_ROWS,
  RELEASE_LINEAGE_BASELINE,
} from "./release-lineage-mapping.js";
import type {
  ArchivedReleaseRow,
  JournalMigration,
  LedgerRow,
  ReleaseRowToArchive,
} from "./release-lineage-normalisation.js";
import {
  type NormalisationMode,
  type ReleaseLineageLedger,
  type ReleaseLineageUnitOfWork,
  normaliseReleaseLineage,
} from "./release-lineage-normaliser.js";

const baseline: LedgerRow = { id: 1, createdAt: RELEASE_LINEAGE_BASELINE.when, hash: "m0127" };
const journal: JournalMigration[] = [{ folderMillis: baseline.createdAt, hash: baseline.hash }];

class InMemoryUnitOfWork implements ReleaseLineageUnitOfWork {
  readonly modes: NormalisationMode[] = [];
  archived: { rows: readonly ReleaseRowToArchive[]; releaseHead: string } | null = null;

  constructor(
    private readonly ledger: LedgerRow[],
    private readonly archive: ArchivedReleaseRow[] = [],
  ) {}

  async run<T>(mode: NormalisationMode, work: (ledger: ReleaseLineageLedger) => Promise<T>) {
    this.modes.push(mode);
    return work({
      readLedger: async () => this.ledger,
      readArchive: async () => this.archive,
      archive: async (rows, releaseHead) => {
        this.archived = { rows, releaseHead };
      },
    });
  }
}

const releaseLedger: LedgerRow[] = [
  baseline,
  ...APPROVED_RELEASE_ROWS.map((row, index) => ({
    id: index + 2,
    createdAt: row.releaseWhen,
    hash: row.sha256,
  })),
];

describe("normaliseReleaseLineage", () => {
  it("refuses an unapproved release head before opening a transaction", async () => {
    const unitOfWork = new InMemoryUnitOfWork(releaseLedger);
    await expect(
      normaliseReleaseLineage({ unitOfWork, journal, releaseHead: "6f5d6b8ed", mode: "apply" }),
    ).rejects.toThrow(/not the approved head/);
    expect(unitOfWork.modes).toEqual([]);
  });

  it("plans without writing on a dry run", async () => {
    const unitOfWork = new InMemoryUnitOfWork(releaseLedger);
    const report = await normaliseReleaseLineage({
      unitOfWork,
      journal,
      releaseHead: APPROVED_RELEASE_HEAD,
      mode: "dry-run",
    });
    expect(unitOfWork.modes).toEqual(["dry-run"]);
    expect(unitOfWork.archived).toBeNull();
    expect(report).toMatchObject({ wrote: false, plan: { status: "archive" } });
  });

  it("archives the approved rows with the release head on apply", async () => {
    const unitOfWork = new InMemoryUnitOfWork(releaseLedger);
    const report = await normaliseReleaseLineage({
      unitOfWork,
      journal,
      releaseHead: APPROVED_RELEASE_HEAD,
      mode: "apply",
    });
    expect(report.wrote).toBe(true);
    expect(unitOfWork.archived?.releaseHead).toBe(APPROVED_RELEASE_HEAD);
    expect(unitOfWork.archived?.rows.map((entry) => entry.row)).toEqual(APPROVED_RELEASE_ROWS);
  });

  it("writes nothing when already normalised", async () => {
    const archive = APPROVED_RELEASE_ROWS.map((row) => ({
      createdAt: row.releaseWhen,
      hash: row.sha256,
      releaseTag: row.releaseTag,
    }));
    const unitOfWork = new InMemoryUnitOfWork([baseline], archive);
    const report = await normaliseReleaseLineage({
      unitOfWork,
      journal,
      releaseHead: APPROVED_RELEASE_HEAD,
      mode: "apply",
    });
    expect(report).toMatchObject({ wrote: false, plan: { status: "already-normalised" } });
    expect(unitOfWork.archived).toBeNull();
  });
});
