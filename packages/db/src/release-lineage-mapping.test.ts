import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPROVED_RELEASE_HEAD,
  APPROVED_RELEASE_ROWS,
  RELEASE_LINEAGE_ADOPTIONS,
  RELEASE_LINEAGE_BASELINE,
  assertApprovedReleaseHead,
} from "./release-lineage-mapping.js";
import { readReleaseSql } from "./testing/production-ledger-fixture.js";

const drizzle = resolve(import.meta.dirname, "../drizzle");
const journal = JSON.parse(readFileSync(resolve(drizzle, "meta/_journal.json"), "utf8")) as {
  entries: { tag: string; when: number }[];
};
const whenByTag = new Map(journal.entries.map((entry) => [entry.tag, entry.when]));
const mainStamps = new Set(journal.entries.map((entry) => entry.when));

function mainSqlHash(tag: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(drizzle, `${tag}.sql`)))
    .digest("hex");
}

describe("release lineage mapping", () => {
  it("recognises only the approved release head", () => {
    expect(() => assertApprovedReleaseHead(APPROVED_RELEASE_HEAD)).not.toThrow();
    expect(() => assertApprovedReleaseHead("6f5d6b8ed")).toThrow(/fail-closed/);
    expect(() => assertApprovedReleaseHead("0".repeat(40))).toThrow(/fail-closed/);
  });

  it("starts above main's 0127, the last migration release and main share", () => {
    expect(whenByTag.get(RELEASE_LINEAGE_BASELINE.tag)).toBe(RELEASE_LINEAGE_BASELINE.when);
    for (const row of APPROVED_RELEASE_ROWS) {
      expect(row.releaseWhen).toBeGreaterThan(RELEASE_LINEAGE_BASELINE.when);
    }
  });

  it("covers release 0128 through 0135 in journal order", () => {
    expect(APPROVED_RELEASE_ROWS.map((row) => row.releaseTag.slice(0, 4))).toEqual([
      "0128",
      "0129",
      "0130",
      "0131",
      "0132",
      "0133",
      "0134",
      "0135",
    ]);
    const stamps = APPROVED_RELEASE_ROWS.map((row) => row.releaseWhen);
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
  });

  it("allows adoption of exactly main 0131a, 0135, 0137, 0138, 0139, 0222 and 0234", () => {
    expect(RELEASE_LINEAGE_ADOPTIONS.map((a) => a.mainTag.split("_")[0]).sort()).toEqual([
      "0131a",
      "0135",
      "0137",
      "0138",
      "0139",
      "0222",
      "0234",
    ]);
  });

  it.each(RELEASE_LINEAGE_ADOPTIONS.map((a) => [a.mainTag, a] as const))(
    "binds adopted %s to main's journal stamp and byte-identical SQL",
    (mainTag, adoption) => {
      expect(whenByTag.get(mainTag)).toBe(adoption.mainWhen);
      expect(mainSqlHash(mainTag)).toBe(adoption.sha256);
    },
  );

  it("keeps release 0135 archived only: main has no migration with its SQL or stamp", () => {
    const row = APPROVED_RELEASE_ROWS.find((r) => r.releaseTag.startsWith("0135_"));
    expect(row?.disposition.kind).toBe("archive-only");
    if (!row) return;
    expect(mainStamps.has(row.releaseWhen)).toBe(false);
    const mainHashes = journal.entries.map((entry) => mainSqlHash(entry.tag));
    expect(mainHashes).not.toContain(row.sha256);
  });

  it("vendors release-only SQL byte-identical to the approved hash", () => {
    for (const row of APPROVED_RELEASE_ROWS) {
      expect(() => readReleaseSql(row)).not.toThrow();
    }
  });
});
