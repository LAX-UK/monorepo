import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const drizzleDir = resolve(import.meta.dirname, "../../drizzle");

type JournalEntry = { idx: number; when: number; tag: string };

function journalEntries(): JournalEntry[] {
  const journal = JSON.parse(readFileSync(resolve(drizzleDir, "meta/_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  return journal.entries;
}

/**
 * The rollback SQL of every migration applied after `tag`, newest first, read from the journal.
 * A rollback test for an older migration runs this first, because the migration runner refuses a
 * rollback while a later migration is still applied. Reading the journal means a new migration
 * needs no edit to older tests. Migrations without a `_rollback.sql` file are skipped.
 */
export function laterRollbackSql(tag: string): string {
  const entries = journalEntries();
  const own = entries.find((entry) => entry.tag === tag);
  if (!own) throw new Error(`Migration ${tag} is not in the journal`);
  return entries
    .filter((entry) => entry.when > own.when)
    .sort((a, b) => b.when - a.when)
    .map((entry) => `${entry.tag.split("_")[0]}_rollback.sql`)
    .filter((name) => existsSync(resolve(drizzleDir, name)))
    .map((name) => readFileSync(resolve(drizzleDir, name), "utf8"))
    .join("\n");
}
