import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

/**
 * Rollback SQL of every migration numbered after `afterNumber`, newest first, as a real rollback
 * would run them. The order comes from the journal, so a new or renumbered migration needs no
 * edit in the tests that call this. Each rollback's own BEGIN/COMMIT is stripped so the SQL stays
 * inside the caller's transaction. A migration without a rollback file is skipped.
 */
export function laterRollbackSql(afterNumber: number): string {
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  return journal.entries
    .map((entry) => entry.tag.slice(0, 4))
    .filter((number) => Number(number) > afterNumber)
    .reverse()
    .map((number) => {
      try {
        return readFileSync(join(drizzleDir, `${number}_rollback.sql`), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n")
    .replaceAll(/^(BEGIN|COMMIT);$/gm, "");
}
