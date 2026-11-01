import { describe, expect, it } from "vitest";
import type { ApprovedReleaseRow } from "./release-lineage-mapping.js";
import {
  type ArchivedReleaseRow,
  type JournalMigration,
  type LedgerRow,
  ReleaseLineageRefusal,
  planReleaseLineageNormalisation,
} from "./release-lineage-normalisation.js";

const BASELINE = 300;
const journal: JournalMigration[] = [
  { folderMillis: 100, hash: "m100" },
  { folderMillis: 200, hash: "m200" },
  { folderMillis: 300, hash: "m300" },
  { folderMillis: 400, hash: "m400" },
  { folderMillis: 450, hash: "r450" },
  { folderMillis: 500, hash: "m500" },
];
const approvedRows: ApprovedReleaseRow[] = [
  {
    releaseTag: "r400",
    releaseWhen: 400,
    sha256: "r400",
    disposition: { kind: "adopt", mainTag: "m600", mainWhen: 600 },
  },
  {
    releaseTag: "r450",
    releaseWhen: 450,
    sha256: "r450",
    disposition: { kind: "adopt", mainTag: "m450", mainWhen: 450 },
  },
  {
    releaseTag: "r700",
    releaseWhen: 700,
    sha256: "r700",
    disposition: { kind: "archive-only", reason: "x" },
  },
];

const shared: LedgerRow[] = [
  { id: 1, createdAt: 100, hash: "m100" },
  { id: 2, createdAt: 200, hash: "m200" },
  { id: 3, createdAt: 300, hash: "m300" },
];
const releaseHead: LedgerRow[] = [
  ...shared,
  { id: 4, createdAt: 400, hash: "r400" },
  { id: 5, createdAt: 450, hash: "r450" },
  { id: 6, createdAt: 700, hash: "r700" },
];
const archived: ArchivedReleaseRow[] = approvedRows.map((row) => ({
  createdAt: row.releaseWhen,
  hash: row.sha256,
  releaseTag: row.releaseTag,
}));

function plan(ledger: LedgerRow[], archive: ArchivedReleaseRow[] = []) {
  return planReleaseLineageNormalisation({
    ledger,
    archive,
    journal,
    approvedRows,
    baselineWhen: BASELINE,
  });
}

describe("release lineage normalisation plan", () => {
  it("archives every release row above the baseline of a ledger at the approved head", () => {
    expect(plan(releaseHead)).toEqual({
      status: "archive",
      rows: [
        { ledgerId: 4, row: approvedRows[0] },
        { ledgerId: 5, row: approvedRows[1] },
        { ledgerId: 6, row: approvedRows[2] },
      ],
    });
  });

  it("archives regardless of the order rows come back in", () => {
    expect(plan([...releaseHead].reverse())).toMatchObject({ status: "archive" });
  });

  it("refuses an unknown row above the baseline", () => {
    expect(() => plan([...releaseHead, { id: 7, createdAt: 800, hash: "x" }])).toThrow(
      ReleaseLineageRefusal,
    );
    expect(() => plan([...releaseHead, { id: 7, createdAt: 800, hash: "x" }])).toThrow(
      /Unknown ledger row at 800 \(hash x\)\. Nothing was changed\./,
    );
  });

  it("refuses a main row above the baseline before normalisation", () => {
    expect(() => plan([...releaseHead, { id: 7, createdAt: 500, hash: "m500" }])).toThrow(
      /Unknown ledger row at 500/,
    );
  });

  it("refuses a release row with a changed hash", () => {
    const changed = releaseHead.map((row) => (row.createdAt === 450 ? { ...row, hash: "y" } : row));
    expect(() => plan(changed)).toThrow(/Ledger row 450 holds y, not the approved r450 hash r450/);
  });

  it("refuses a ledger that is not at the approved head (a release row is missing)", () => {
    expect(() => plan(releaseHead.filter((row) => row.createdAt !== 700))).toThrow(
      /no r700 row at 700; it is not at the approved release head/,
    );
  });

  it("refuses an unknown or changed row in the shared prefix", () => {
    expect(() => plan([{ id: 9, createdAt: 150, hash: "z" }, ...releaseHead])).toThrow(
      /Unknown ledger row at 150/,
    );
    const changed = releaseHead.map((row) => (row.createdAt === 200 ? { ...row, hash: "z" } : row));
    expect(() => plan(changed)).toThrow(/Ledger row 200 does not hold main's hash/);
  });

  it("refuses a ledger that does not reach the baseline", () => {
    expect(() => plan(shared.slice(0, 2))).toThrow(/does not reach the shared baseline 300/);
  });

  it("refuses duplicate stamps", () => {
    expect(() => plan([...releaseHead, { id: 8, createdAt: 400, hash: "r400" }])).toThrow(
      /two rows at 400/,
    );
  });

  it("reports an already normalised ledger, before and after main's migrations ran", () => {
    expect(plan(shared, archived)).toEqual({
      status: "already-normalised",
      mainRowsAboveBaseline: 0,
    });
    const migrated = [
      ...shared,
      { id: 10, createdAt: 400, hash: "m400" },
      { id: 11, createdAt: 450, hash: "r450" },
      { id: 12, createdAt: 500, hash: "m500" },
    ];
    expect(plan(migrated, archived)).toEqual({
      status: "already-normalised",
      mainRowsAboveBaseline: 3,
    });
  });

  it("refuses when the archive exists but release rows are still in the ledger", () => {
    expect(() => plan(releaseHead, archived)).toThrow(
      /Ledger row 400 is neither a main migration nor in the archive/,
    );
  });

  it("refuses an incomplete or extended archive", () => {
    expect(() => plan(shared, archived.slice(1))).toThrow(
      /archive does not hold the approved r400 row/,
    );
    expect(() =>
      plan(shared, [...archived, { createdAt: 900, hash: "q", releaseTag: "r900" }]),
    ).toThrow(/archive holds rows the approved head does not/);
    expect(() =>
      plan(
        shared,
        archived.map((row) => (row.createdAt === 700 ? { ...row, hash: "other" } : row)),
      ),
    ).toThrow(/archive does not hold the approved r700 row/);
  });
});
