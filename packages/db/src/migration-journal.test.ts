import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(__dirname, "../drizzle");

type Journal = { entries: { idx: number; tag: string; when: number }[] };

function loadJournal(): Journal {
  return JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8")) as Journal;
}

/**
 * Guards against the failure where a migration SQL file exists on disk but is not
 * registered in `_journal.json`. Drizzle's migrator (`readMigrationFiles`) only
 * applies migrations listed in the journal, so an unregistered file is silently
 * skipped on every deploy — exactly how `0102_notification_submission_id` shipped
 * without ever creating the `notification.submission_id` column in production.
 */
describe("drizzle migration journal", () => {
  const sqlMigrations = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql") && !f.endsWith("_rollback.sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();

  it("registers every migration SQL file in _journal.json", () => {
    const journalTags = new Set(loadJournal().entries.map((e) => e.tag));
    const missing = sqlMigrations.filter((tag) => !journalTags.has(tag));
    expect(missing, `migration files missing from _journal.json: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("has no journal entries without a matching SQL file", () => {
    const sqlSet = new Set(sqlMigrations);
    const orphaned = loadJournal()
      .entries.map((e) => e.tag)
      .filter((tag) => !sqlSet.has(tag));
    expect(orphaned, `journal entries with no SQL file: ${orphaned.join(", ")}`).toEqual([]);
  });

  it("uses unique idx and strictly increasing `when` in journal order", () => {
    const entries = loadJournal().entries;
    const idxs = entries.map((e) => e.idx);
    expect(new Set(idxs).size, "duplicate idx values in _journal.json").toBe(idxs.length);
    for (let i = 1; i < entries.length; i += 1) {
      expect(
        entries[i].when,
        `journal "when" must strictly increase: ${entries[i - 1].tag} -> ${entries[i].tag}`,
      ).toBeGreaterThan(entries[i - 1].when);
    }
  });
});
